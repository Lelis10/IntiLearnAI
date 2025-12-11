import json

from typing import List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.rag_engine import RAGEngine

router = APIRouter()

# Initialize RAG Engine (Global instance to keep model in memory)
# In a production app, we might want to use lifespan events, but this is fine for now.
try:
    rag_engine = RAGEngine()
except Exception as e:
    print(f"Error initializing RAG Engine: {e}")
    rag_engine = None

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
    if not rag_engine:
        raise HTTPException(status_code=503, detail="AI Model not initialized")
    
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
