from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import query, interview, ingest
from app.config import settings

app = FastAPI(title="Placement Prep AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(query.router, prefix="/api/query", tags=["query"])
app.include_router(interview.router, prefix="/api/interview", tags=["interview"])
app.include_router(ingest.router, prefix="/api/ingest", tags=["ingest"])


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import query, interview, ingest
from app.config import settings

app = FastAPI(title="Placement Prep AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(query.router, prefix="/api/query", tags=["query"])
app.include_router(interview.router, prefix="/api/interview", tags=["interview"])
app.include_router(ingest.router, prefix="/api/ingest", tags=["ingest"])

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
