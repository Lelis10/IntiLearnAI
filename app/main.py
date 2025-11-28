from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import router
import uvicorn

app = FastAPI(
    title="IntiLearnAI API",
    description="Backend para el asistente educativo offline IntiLearnAI",
    version="0.1.0"
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
    return {"message": "IntiLearnAI API is running"}

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
