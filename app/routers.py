import json

from typing import List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.rag_engine import RAGEngine
from app.state import app_state

router = APIRouter()

# Global initialization is now handled in app/state.py and app/main.py lifespan

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[dict]] = None
    subject: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    sources: list
    suggested_subject: Optional[str] = None

@router.post("/chat")
async def chat(request: ChatRequest):
    if not app_state.rag_engine or app_state.status != "ready":
        detail = "AI Model is still loading..." if app_state.status == "loading_model" else "AI Model failed to load"
        if app_state.status == "error":
            detail = f"AI Startup Error: {app_state.error_message}"
        raise HTTPException(status_code=503, detail=detail)
    
    rag_engine = app_state.rag_engine
    
    try:
        # Use streaming with subject-aware retrieval
        generator, sources, suggested_subject = rag_engine.query(
            request.message,
            subject=request.subject,
            history=request.history,
            stream=True,
        )
        
        def event_generator():
            # First yield sources and suggestion
            initial_data = {"sources": sources}
            if suggested_subject:
                initial_data["suggested_subject"] = suggested_subject
            
            yield json.dumps(initial_data) + "\n"
            
            # Then yield tokens
            for chunk in generator:
                if 'choices' in chunk:
                    token = chunk['choices'][0]['text']
                    yield json.dumps({"token": token}) + "\n"

        return StreamingResponse(event_generator(), media_type="application/x-ndjson")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
