from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import search, personalization, leetcode
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

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
