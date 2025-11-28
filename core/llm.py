import os
import torch
from dotenv import load_dotenv
from transformers import AutoModelForCausalLM, AutoTokenizer

load_dotenv()

class LLM:
    def __init__(self):
        model_path = os.getenv("LLM_MODEL_PATH")
        self.model = AutoModelForCausalLM.from_pretrained(model_path)
        self.tokenizer = AutoTokenizer.from_pretrained(model_path)
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model.to(self.device)

    def generate(self, prompt, max_length=200):
        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.device)
        outputs = self.model.generate(**inputs, max_length=max_length)
        return self.tokenizer.decode(outputs[0], skip_special_tokens=True)

if __name__ == "__main__":
    from rag import RAGSystem
    rag = RAGSystem()
    query = "Explica la multiplicación"
    context = rag.retrieve(query)
    prompt = f"Contexto: {context}\nPregunta: {query}\nRespuesta como instructor:"
    llm = LLM()
    response = llm.generate(prompt)
    print("Respuesta generada:", response)