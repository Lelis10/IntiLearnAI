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
     # Ruta principal (GGUF/INT4) para hardware estándar (>=8GB RAM o GPU >=4GB)
     LLM_MODEL_PATH=models/gemma-2-2b-it-gguf
     # Ruta fallback (GGUF/INT4) para hardware limitado
     LLM_FALLBACK_MODEL_PATH=models/gemma-2-1.1b-it-gguf
     ```

3. **Descarga del Modelo (principal + fallback)**:
   ```bash
   python core/download_llm_gguf.py
   ```
   - El script descarga modelos Gemma cuantizados en GGUF/INT4 y valida integridad (tamaño y checksum si se define
     `LLM_MODEL_PATH_SHA256` / `LLM_FALLBACK_MODEL_PATH_SHA256`).

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
