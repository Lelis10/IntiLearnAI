from fastapi import FastAPI
from pydantic import BaseModel
from core.rag import RAGSystem
from core.llm import LLM
from core.whisper_stt import STT
from core.tts import TTS
import os

app = FastAPI()

rag = RAGSystem()
llm = LLM()
stt = STT()
tts = TTS()

class Query(BaseModel):
    text: str

class AudioQuery(BaseModel):
    audio_path: str

@app.post("/generate")
def generate_response(query: Query):
    context = rag.retrieve(query.text, top_k=3)
    prompt = f"Contexto: {context}\nPregunta: {query.text}\nRespuesta didáctica:"
    response = llm.generate(prompt)
    return {"response": response}

@app.post("/transcribe")
def transcribe_audio(audio: AudioQuery):
    text = stt.transcribe(audio.audio_path)
    return {"text": text}

@app.post("/synthesize")
def synthesize_text(query: Query):
    audio_path = tts.synthesize(query.text)
    return {"audio_path": audio_path}