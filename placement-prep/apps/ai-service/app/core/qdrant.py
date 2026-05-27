from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue, MatchAny
from app.config import settings

_client = None

def get_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(url=settings.QDRANT_URL, api_key=settings.QDRANT_API_KEY)
    return _client

async def semantic_search(
    query_vector: list[float],
    topic_filters: list[str] | None = None,
    difficulty: str | None = None,
    limit: int = 20
) -> list[dict]:
    client = get_client()
    
    must_conditions = []
    
    if difficulty:
        must_conditions.append(
            FieldCondition(key="difficulty", match=MatchValue(value=difficulty))
        )
    
    if topic_filters and len(topic_filters) > 0:
        must_conditions.append(
            FieldCondition(key="topic_tags", match=MatchAny(any=topic_filters))
        )
        
    query_filter = Filter(must=must_conditions) if must_conditions else None
    
    response = client.query_points(
        collection_name=settings.QDRANT_COLLECTION_NAME,
        query=query_vector,
        query_filter=query_filter,
        limit=limit,
        with_payload=True
    )
    results = response.points
    
    return [
        {
            "id": point.payload.get("id"),
            "title": point.payload.get("title"),
            "slug": point.payload.get("slug"),
            "difficulty": point.payload.get("difficulty"),
            "category": point.payload.get("category"),
            "topic_tags": point.payload.get("topic_tags", []),
            "score": point.score
        }
        for point in results
    ]

async def scroll_by_tags(
    topic_filters: list[str] | None = None,
    difficulty: str | None = None,
    limit: int = 50
) -> list[dict]:
    client = get_client()
    
    must_conditions = []
    
    if difficulty:
        must_conditions.append(
            FieldCondition(key="difficulty", match=MatchValue(value=difficulty))
        )
    
    if topic_filters and len(topic_filters) > 0:
        must_conditions.append(
            FieldCondition(key="topic_tags", match=MatchAny(any=topic_filters))
        )
        
    query_filter = Filter(must=must_conditions) if must_conditions else None
    
    results, _next_page = client.scroll(
        collection_name=settings.QDRANT_COLLECTION_NAME,
        scroll_filter=query_filter,
        limit=limit,
        with_payload=True,
        with_vectors=False
    )
    
    return [
        {
            "id": point.payload.get("id"),
            "title": point.payload.get("title"),
            "slug": point.payload.get("slug"),
            "difficulty": point.payload.get("difficulty"),
            "category": point.payload.get("category"),
            "topic_tags": point.payload.get("topic_tags", [])
        }
        for point in results
    ]
