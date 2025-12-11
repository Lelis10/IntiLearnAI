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

3. **Descarga del Modelo (Gemma 2 2B por defecto)**:
   ```bash
   python core/download_llm.py
   ```

4. **Configurar Llama 3.2 1B Instruct en 4 bits (GGUF)**:
   - Recomendado para equipos modestos: más rápido y ligero que Gemma 2 2B.
   - Crea/edita tu `.env` con las siguientes variables (con tu token de HF):
     ```
     HF_TOKEN=tu_token_huggingface
     LLM_MODEL_PATH=models/llama-3.2-1b-instruct-gguf
     LLM_MODEL_FORMAT=gguf
     LLM_MODEL_ID=meta-llama/Llama-3.2-1B-Instruct-GGUF
     LLM_MODEL_FILE=Llama-3.2-1B-Instruct-Q4_K_M.gguf
     LLM_RUNTIME=gguf
     LLM_CONTEXT_SIZE=2048
     LLM_BATCH_SIZE=256
     ```
   - Descarga el modelo cuantizado de 4 bits:
     ```bash
     python core/download_llm.py
     ```
   - El runtime detectará automáticamente el archivo `.gguf` y usará `llama.cpp`.

5. **Ingesta de Datos (RAG)**:
   - Coloca tus PDFs o archivos de texto en la carpeta `data/`.
   - Ejecuta:
     ```bash
     python core/ingest_data.py
     ```

6. **Prueba de Inferencia**:
   ```bash
   python core/inference.py
   ```
