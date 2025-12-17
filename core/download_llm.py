from dotenv import load_dotenv
from transformers import AutoModelForCausalLM, AutoTokenizer
from huggingface_hub import hf_hub_download
import os
import shutil
import sys

def download_model():
    load_dotenv()
    hf_token = os.getenv("HF_TOKEN")
    save_path = os.getenv("LLM_MODEL_PATH")
    model_name = os.getenv("LLM_MODEL_ID", "google/gemma-2-2b-it")
    model_format = os.getenv("LLM_MODEL_FORMAT", "transformers").lower()
    gguf_filename = os.getenv("LLM_MODEL_FILE", "Llama-3.2-1B-Instruct-Q4_K_M.gguf")

    if not hf_token:
        print("Error: HF_TOKEN not found in .env file.")
        sys.exit(1)
    
    if not save_path:
        print("Error: LLM_MODEL_PATH not found in .env file.")
        sys.exit(1)

    if model_format == "gguf":
        print(f"Downloading GGUF model {model_name}/{gguf_filename}...")
        try:
            downloaded_file = hf_hub_download(
                repo_id=model_name, filename=gguf_filename, token=hf_token
            )
            os.makedirs(save_path, exist_ok=True)
            target_path = os.path.join(save_path, gguf_filename)
            shutil.copy(downloaded_file, target_path)
            print(f"Model file saved to {target_path}")
        except Exception as e:
            print(f"Failed to download GGUF model: {e}")
            sys.exit(1)
    else:
        print(f"Downloading model {model_name}...")
        try:
            tokenizer = AutoTokenizer.from_pretrained(model_name, token=hf_token)
            model = AutoModelForCausalLM.from_pretrained(
                model_name,
                token=hf_token,
                device_map="cpu",
                torch_dtype="auto"
            )

            print(f"Saving model to {save_path}...")
            model.save_pretrained(save_path)
            tokenizer.save_pretrained(save_path)
            print(f"Model {model_name} successfully downloaded to {save_path}")

        except Exception as e:
            print(f"Failed to download model: {e}")
            sys.exit(1)

if __name__ == "__main__":
    download_model()
