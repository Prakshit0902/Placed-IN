import uuid
from typing import Any

from google import genai
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    PointStruct,
    VectorParams,
)

from config import config
from pipeline.topic_mapper import normalize_topics
from pipeline.quality_validator import QualityValidator
from pipeline.canonicalizer import SupabaseCanonicalizer


class Embedder:
    def __init__(self):
        self.genai_client = genai.Client(api_key=config.GEMINI_API_KEY)
        self.client = QdrantClient(
            url=config.QDRANT_URL,
            api_key=config.QDRANT_API_KEY,
        )
        self.available_embedding_model = config.EMBEDDING_MODEL
        self.embedding_dimension = config.EMBEDDING_DIMENSION
        
        self.quality_validator = QualityValidator()
        self.canonicalizer = SupabaseCanonicalizer()
        
        self._fetch_available_embedding_model()
        self._detect_embedding_dimension()
        self._ensure_collection()

    def _fetch_available_embedding_model(self):
        """Try to find an available embedding model from Gemini."""
        try:
            for model in self.genai_client.models.list(config={'query_base': True}):
                # Look for embedding models
                if 'embedding' in model.name.lower():
                    self.available_embedding_model = model.name
                    print(f"[Embedder] Using available embedding model: {self.available_embedding_model}")
                    return
        except Exception as e:
            print(f"[Embedder] Could not fetch available embedding models: {e}, using configured model")
            self.available_embedding_model = config.EMBEDDING_MODEL

    def _detect_embedding_dimension(self) -> None:
        """Detect the actual output dimension of the selected embedding model."""
        probe_text = "dimension probe"
        try:
            result = self.genai_client.models.embed_content(
                model=self.available_embedding_model,
                contents=probe_text,
            )
            if result.embeddings and result.embeddings[0].values:
                self.embedding_dimension = len(result.embeddings[0].values)
                print(
                    f"[Embedder] Detected embedding dimension: {self.embedding_dimension}"
                )
        except Exception as e:
            print(
                f"[Embedder] Could not detect embedding dimension, using configured size {self.embedding_dimension}: {e}"
            )

    def _ensure_collection(self) -> None:
        """
        Create Qdrant collection if it doesn't exist yet.
        Safe to call multiple times — won't recreate if exists.
        """
        collections = self.client.get_collections().collections
        names = [c.name for c in collections]

        if config.QDRANT_COLLECTION_NAME not in names:
            self.client.create_collection(
                collection_name=config.QDRANT_COLLECTION_NAME,
                vectors_config=VectorParams(
                    size=self.embedding_dimension,
                    distance=Distance.COSINE,
                ),
            )
            print(
                f"[Embedder] Created collection '{config.QDRANT_COLLECTION_NAME}' with dimension {self.embedding_dimension}"
            )
        else:
            self._ensure_collection_dimension()

    def _ensure_collection_dimension(self) -> None:
        """Ensure the existing collection matches the current embedding dimension."""
        try:
            info = self.client.get_collection(collection_name=config.QDRANT_COLLECTION_NAME)
            vector_params = getattr(info.config.params, "vectors", None)
            existing_dim = None

            if hasattr(vector_params, "size"):
                existing_dim = vector_params.size
            elif isinstance(vector_params, dict):
                first_vector = next(iter(vector_params.values()), None)
                if first_vector and hasattr(first_vector, "size"):
                    existing_dim = first_vector.size

            if existing_dim and existing_dim != self.embedding_dimension:
                print(
                    f"[Embedder] Collection dimension mismatch detected: existing={existing_dim}, embedding={self.embedding_dimension}. Recreating collection."
                )
                self.client.delete_collection(collection_name=config.QDRANT_COLLECTION_NAME)
                self.client.create_collection(
                    collection_name=config.QDRANT_COLLECTION_NAME,
                    vectors_config=VectorParams(
                        size=self.embedding_dimension,
                        distance=Distance.COSINE,
                    ),
                )
                print(
                    f"[Embedder] Recreated collection '{config.QDRANT_COLLECTION_NAME}' with dimension {self.embedding_dimension}"
                )
            else:
                print(
                    f"[Embedder] Collection '{config.QDRANT_COLLECTION_NAME}' ready (dimension {existing_dim or self.embedding_dimension})"
                )
        except Exception as e:
            print(f"[Embedder] Could not verify collection dimension: {e}")

    def embed_and_store(self, records: list[dict[str, Any]]) -> int:
        """
        Embed cleaned records and store them in Qdrant.
        Returns number of records successfully stored.
        """
        if not records:
            print("[Embedder] No records to embed")
            return 0

        points = []

        for i, record in enumerate(records):
            print(f"[Embedder] Processing record {i + 1}/{len(records)}")

            # 1. Topic Normalization
            if "topics" in record:
                record["topics"] = normalize_topics(record["topics"])

            # 2. Quality Validation
            quality = self.quality_validator.validate(record)
            if not quality.passed:
                print(f"[Embedder] Dropping record '{record.get('company')}': {quality.rejection_reason}")
                continue
                
            if quality.warnings:
                print(f"[Embedder] Warnings for record: {quality.warnings}")

            # 3. Canonicalization
            source_url = record.get("question_url") or record.get("source_url") or ""
            raw_title = record.get("question_text", "Untitled")[:150] # safeguard length
            try:
                canonical_id = self.canonicalizer.resolve_canonical_id(raw_title, source_url, record)
                record["canonical_id"] = canonical_id
            except Exception as e:
                print(f"[Embedder] Canonicalization failed for record {i+1}: {e}")
                continue

            # Build text to embed — combine key fields for richer embedding
            text_to_embed = self._build_embed_text(record)

            try:
                vector = self._get_embedding(text_to_embed)
            except Exception as e:
                print(f"[Embedder] Embedding failed for record {i + 1}: {e}")
                continue

            point = PointStruct(
                id=canonical_id, # Use Canonical ID (UUID string) as Qdrant ID to seamlessly overwrite/merge
                vector=vector,
                payload=self._build_payload(record),
            )
            points.append(point)

        if not points:
            print("[Embedder] No points to store after pipeline validation")
            return 0

        # Store in batches to avoid overwhelming Qdrant
        stored = self._store_in_batches(points)
        print(f"[Embedder] Stored {stored} records in Qdrant")
        return stored

    def _build_payload(self, record: dict[str, Any]) -> dict[str, Any]:
        """
        Build the metadata payload stored alongside the vector.
        This is what gets returned when a user queries Qdrant.
        Keep it flat and filterable.
        """
        payload = {
            "canonical_id": record.get("canonical_id", ""),
            "source": record.get("source", "unknown"),
            "url": record.get("url", "") or record.get("question_url", ""),
            "company": record.get("company", "Unknown"),
            "role": record.get("role", "SDE"),
            "round": record.get("round", "unknown"),
            "difficulty": record.get("difficulty", "medium"),
            "outcome": record.get("outcome", "unknown"),
            "year": record.get("year", 0),
            "topics": record.get("topics", []),
            "questions": record.get("questions", []),
            "question_text": record.get("question_text", ""),
            "question_url": record.get("question_url", ""),
        }
        return payload

    def _build_embed_text(self, record: dict[str, Any]) -> str:
        """
        Combine the most semantically rich fields into
        one string for embedding. More context = better retrieval.
        """
        parts = []

        if record.get("company"):
            parts.append(f"Company: {record['company']}")

        if record.get("role"):
            parts.append(f"Role: {record['role']}")

        if record.get("round"):
            parts.append(f"Round: {record['round']}")

        if record.get("topics"):
            parts.append(f"Topics: {', '.join(record['topics'])}")

        if record.get("summary"):
            parts.append(f"Summary: {record['summary']}")

        if record.get("question_text"):
            parts.append(f"Question: {record['question_text']}")
        elif record.get("questions"):
            questions_text = " | ".join(record["questions"][:10])
            parts.append(f"Questions: {questions_text}")

        return "\n".join(parts)

    def _get_embedding(self, text: str) -> list[float]:
        """
        Get embedding vector from Gemini embedding model.
        Handles 404 errors by finding an available model.
        Handles 429 rate limit errors by waiting exactly as long as required.
        """
        import time
        import re

        max_retries = 3

        for attempt in range(max_retries):
            try:
                result = self.genai_client.models.embed_content(
                    model=self.available_embedding_model,
                    contents=text,
                )
                vector = result.embeddings[0].values
                if len(vector) != self.embedding_dimension:
                    print(
                        f"[Embedder] Embedding dimension changed from {self.embedding_dimension} to {len(vector)}; updating in-memory dimension"
                    )
                    self.embedding_dimension = len(vector)
                return vector
            except Exception as e:
                error_msg = str(e)
                
                # Handle Rate Limiting (429)
                if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
                    if attempt < max_retries - 1:
                        # Extract exact retry time from "retry in 41.950s" or fallback to 15s
                        match = re.search(r"retry.*?(\d+(?:\.\d+)?)\s*s", error_msg, re.IGNORECASE)
                        delay = float(match.group(1)) + 1.0 if match else 15.0  # Add 1s buffer
                        print(f"[Embedder] 429 Rate limit hit. Scaling back temporarily. Sleeping {delay:.1f}s (attempt {attempt + 1}/{max_retries})...")
                        time.sleep(delay)
                        continue
                    else:
                        raise

                # Handle Missing Model (404)
                if "404" in error_msg or "not found" in error_msg.lower():
                    print(f"[Embedder] Model '{self.available_embedding_model}' not found, discovering available model...")
                    self._fetch_available_embedding_model()
                    if attempt < max_retries - 1:
                        continue

                # Unhandled error
                raise



    def _store_in_batches(self, points: list[PointStruct]) -> int:
        """
        Upload points to Qdrant in batches of BATCH_SIZE.
        """
        stored = 0
        batch_size = config.BATCH_SIZE

        for i in range(0, len(points), batch_size):
            batch = points[i : i + batch_size]
            try:
                self.client.upsert(
                    collection_name=config.QDRANT_COLLECTION_NAME,
                    points=batch,
                )
                stored += len(batch)
                print(
                    f"[Embedder] Batch {i // batch_size + 1} stored "
                    f"({len(batch)} points)"
                )
            except Exception as e:
                print(f"[Embedder] Batch storage failed: {e}")

        return stored