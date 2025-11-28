from huggingface_hub import hf_hub_download
import os
from dotenv import load_dotenv

def download_gguf_model():
    load_dotenv()
    save_path = os.getenv("LLM_MODEL_PATH", "models")
    os.makedirs(save_path, exist_ok=True)
    
    # Example: Gemma 2B Quantized (GGUF)
    # We use a popular quantization repo. 
    # Note: You might need to change this to a specific repo you trust or the official one if available.
    repo_id = "bartowski/gemma-2-2b-it-GGUF" 
    filename = "gemma-2-2b-it-Q4_K_M.gguf" # 4-bit Medium Quantization (Balanced)

    print(f"Downloading {filename} from {repo_id}...")
    try:
        model_path = hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            local_dir=save_path,
            local_dir_use_symlinks=False
        )
        print(f"Model downloaded to: {model_path}")
        return model_path
    except Exception as e:
        print(f"Error downloading GGUF model: {e}")
        return None

if __name__ == "__main__":
    download_gguf_model()
