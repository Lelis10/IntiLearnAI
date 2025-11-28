from dotenv import load_dotenv
from transformers import AutoModelForCausalLM, AutoTokenizer
import os
import sys

def download_model():
    load_dotenv()
    hf_token = os.getenv("HF_TOKEN")
    save_path = os.getenv("LLM_MODEL_PATH")
    model_name = "google/gemma-2-2b-it"

    if not hf_token:
        print("Error: HF_TOKEN not found in .env file.")
        sys.exit(1)
    
    if not save_path:
        print("Error: LLM_MODEL_PATH not found in .env file.")
        sys.exit(1)

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