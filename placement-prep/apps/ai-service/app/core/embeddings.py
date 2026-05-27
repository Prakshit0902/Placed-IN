from sentence_transformers import SentenceTransformer

_model = None

def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        # Load the same model used during ingestion to maintain 384-dim vector compatibility
        _model = SentenceTransformer("BAAI/bge-small-en-v1.5", device="cpu")
    return _model

def embed_query(text: str) -> list[float]:
    """
    Generates a 384-dimensional dense vector for the given text query.
    """
    if not text or not text.strip():
        # Return zero vector if empty query to avoid model error
        return [0.0] * 384
        
    # Generate embedding and convert to standard python float list
    vector = get_model().encode(text, convert_to_numpy=True).tolist()
    return vector
