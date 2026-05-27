from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.llm import extract_filters_gemini
from app.core.embeddings import embed_query
from app.core.qdrant import semantic_search
from app.core.supabase import get_supabase

router = APIRouter()

class SearchRequest(BaseModel):
    query: str
    limit: int = 20

@router.post("/")
async def search_problems(req: SearchRequest):
    query_text = req.query
    
    # 1. Extract filters using Gemini Flash
    filters = extract_filters_gemini(query_text)
    
    topic_filters = filters.get("topics", [])
    difficulty_filter = filters.get("difficulty")
    company_filter = filters.get("company")
    
    # 2. Embed the query for semantic search
    vector = embed_query(query_text)
    
    # 3. Qdrant semantic search with payload filters
    qdrant_results = await semantic_search(
        query_vector=vector,
        topic_filters=topic_filters,
        difficulty=difficulty_filter,
        limit=req.limit * 2  # fetch more to allow re-ranking
    )
    
    if not qdrant_results:
        return {"results": [], "filters_extracted": filters}
        
    problem_ids = [p["id"] for p in qdrant_results]
    
    # 4. Fetch frequency from Supabase lc_company_questions for re-ranking
    supabase = get_supabase()
    
    freq_map: dict[int, float] = {}
    if company_filter:
        res = supabase.table("lc_company_questions")\
            .select("problem_id, frequency")\
            .in_("problem_id", problem_ids)\
            .ilike("company", company_filter)\
            .execute()
    else:
        res = supabase.table("lc_company_questions")\
            .select("problem_id, frequency")\
            .in_("problem_id", problem_ids)\
            .execute()
            
    if res.data:
        for r in res.data:
            pid = r["problem_id"]
            freq = r.get("frequency") or 0
            if pid not in freq_map or freq > freq_map[pid]:
                freq_map[pid] = freq

    # 5. Re-rank results combining semantic score and frequency
    for p in qdrant_results:
        pid = p["id"]
        freq = freq_map.get(pid, 0)
        p["frequency"] = freq
        p["combined_score"] = p["score"] + (min(freq, 100) / 100.0) * 0.2
        
    qdrant_results.sort(key=lambda x: x.get("combined_score", 0), reverse=True)
    
    return {
        "results": qdrant_results[:req.limit],
        "filters_extracted": filters
    }
