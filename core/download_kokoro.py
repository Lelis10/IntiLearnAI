from dotenv import load_dotenv
from huggingface_hub import snapshot_download
import os

load_dotenv()
hf_token = os.getenv("HF_TOKEN")
model_name = "hexgrad/Kokoro-82M"

save_path = os.getenv("KOKORO_MODEL_PATH")
snapshot_download(repo_id=model_name, local_dir=save_path, token=hf_token)
print(f"Modelo Kokoro descargado en {save_path}")