from contextlib import asynccontextmanager
import threading
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import router
from app.state import app_state
import uvicorn

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Launch model loading in a separate thread
    thread = threading.Thread(target=app_state.initialize_rag, daemon=True)
    thread.start()
    yield
    # Shutdown: Clean up if needed (threads are daemon, so they'll die)

app = FastAPI(
    title="IntiLearnAI API",
    description="Backend para el asistente educativo offline IntiLearnAI",
    version="0.1.0",
    lifespan=lifespan
)

# CORS Configuration (Allow all for local development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(router)

@app.get("/")
async def root():
    return {
        "message": "IntiLearnAI API is running",
        "status": app_state.status
    }

@app.get("/health")
async def health():
    return {
        "status": app_state.status,
        "detail": app_state.error_message
    }

if __name__ == "__main__":
    # Disable reload for performance in production/desktop use
    # Disable access_log to reduce "GET /health" noise in console
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False, log_level="info", access_log=False)
