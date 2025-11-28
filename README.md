# IntiLearnAI

Asistente educativo offline para zonas rurales basado en IA.

## Características

- RAG local con FAISS
- Modelos Gemma / Mistral offline
- Whisper (voz a texto)
- Coqui TTS (texto a voz)
- Streamlit + FastAPI

## Setup

1. **Entorno Virtual**:
   ```bash
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Configuración**:
   - Crea un archivo `.env` con:
     ```
     HF_TOKEN=tu_token_huggingface
     LLM_MODEL_PATH=models/gemma-2-2b-it
     ```

3. **Descarga del Modelo**:
   ```bash
   python core/download_llm.py
   ```

4. **Ingesta de Datos (RAG)**:
   - Coloca tus PDFs o archivos de texto en la carpeta `data/`.
   - Ejecuta:
     ```bash
     python core/ingest_data.py
     ```

5. **Prueba de Inferencia**:
   ```bash
   python core/inference.py
   ```
