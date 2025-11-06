from dotenv import load_dotenv
from transformers import AutoModelForCausalLM, AutoTokenizer
import os

load_dotenv()
hf_token = os.getenv("HF_TOKEN")
model_name = "google/gemma-2-2b-it"  # O "mistralai/Mistral-7B-Instruct-v0.3" para Mistral

model = AutoModelForCausalLM.from_pretrained(model_name, token=hf_token)
print("hola")
tokenizer = AutoTokenizer.from_pretrained(model_name, token=hf_token)
save_path = os.getenv("LLM_MODEL_PATH")
print(save_path)
model.save_pretrained(save_path)
tokenizer.save_pretrained(save_path)
print(f"Modelo {model_name} descargado en {save_path}")