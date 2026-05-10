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


class Embedder:
    def __init__(self):
        self.genai_client = genai.Client(api_key=config.GEMINI_API_KEY)
        self.client = QdrantClient(
            url=config.QDRANT_URL,
            api_key=config.QDRANT_API_KEY,
        )
        self.available_embedding_model = config.EMBEDDING_MODEL
        self.embedding_dimension = config.EMBEDDING_DIMENSION
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
            print(f"[Embedder] Embedding record {i + 1}/{len(records)}")

            # Build text to embed — combine key fields for richer embedding
            text_to_embed = self._build_embed_text(record)

            try:
                vector = self._get_embedding(text_to_embed)
            except Exception as e:
                print(f"[Embedder] Embedding failed for record {i + 1}: {e}")
                continue

            point = PointStruct(
                id=str(uuid.uuid4()),
                vector=vector,
                payload=self._build_payload(record),
            )
            points.append(point)

        if not points:
            print("[Embedder] No points to store after embedding")
            return 0

        # Store in batches to avoid overwhelming Qdrant
        stored = self._store_in_batches(points)
        print(f"[Embedder] Stored {stored} records in Qdrant")
        return stored

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

        if record.get("questions"):
            questions_text = " | ".join(record["questions"][:10])
            parts.append(f"Questions: {questions_text}")

        return "\n".join(parts)

    def _get_embedding(self, text: str) -> list[float]:
        """
        Get embedding vector from Gemini embedding model.
        Handles 404 errors by attempting to find an available model.
        """
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
            if "404" in error_msg or "not found" in error_msg.lower():
                print(f"[Embedder] Model '{self.available_embedding_model}' not found, attempting to find available model")
                self._fetch_available_embedding_model()
                # Retry with new model
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
                except Exception as retry_e:
                    print(f"[Embedder] Retry failed: {retry_e}")
                    raise
            else:
                raise

    def _build_payload(self, record: dict[str, Any]) -> dict[str, Any]:
        """
        Build the metadata payload stored alongside the vector.
        This is what gets returned when a user queries Qdrant.
        Keep it flat and filterable.
        """
        return {
            "source": record.get("source", "unknown"),
            "url": record.get("url", ""),
            "company": record.get("company", "Unknown"),
            "role": record.get("role", "SDE"),
            "round": record.get("round", "unknown"),
            "difficulty": record.get("difficulty", "medium"),
            "outcome": record.get("outcome", "unknown"),
            "year": record.get("year", 0),
            "topics": record.get("topics", []),
            "questions": record.get("questions", []),
            "summary": record.get("summary", ""),
        }

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