"""
Core Player Backend - FastAPI application
Music streaming server with Navidrome integration
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import httpx
from app.config import settings
from app.database import init_db
from app.routers import auth, library, stream, lyrics


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager
    Handles startup and shutdown events
    """
    # Startup: Initialize database and httpx client
    await init_db()
    
    app.state.httpx_client = httpx.AsyncClient(
        timeout=httpx.Timeout(30.0, read=60.0),
        follow_redirects=False,
        limits=httpx.Limits(max_keepalive_connections=20, max_connections=100)
    )
    
    print("✓ Database initialized")
    print("✓ HTTP client created")
    print(f"✓ Server starting on http://localhost:8000")
    
    yield
    
    # Shutdown: Close httpx client
    await app.state.httpx_client.aclose()
    print("✓ HTTP client closed")


# Create FastAPI app
app = FastAPI(
    title="Core Player API",
    description="Music streaming server with Navidrome integration",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(library.router, prefix="/api")
app.include_router(stream.router, prefix="/api")
app.include_router(lyrics.router, prefix="/api")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "Core Player API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
