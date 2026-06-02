from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import search, personalization, leetcode, explain, profile
from app.config import settings

app = FastAPI(title="Placement Prep AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search.router, prefix="/api/query/search", tags=["search"])
app.include_router(personalization.router, prefix="/api/ingest/personalize", tags=["personalize"])
app.include_router(leetcode.router, prefix="/api/leetcode", tags=["leetcode"])
app.include_router(explain.router, prefix="/api/query/explain", tags=["explain"])
app.include_router(profile.router, prefix="/api/ingest/profile", tags=["profile"])

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
