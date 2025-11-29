import os
import faiss
import pickle
import numpy as np
from sentence_transformers import SentenceTransformer
from core.inference import LocalLLM
from dotenv import load_dotenv

class RAGEngine:
    def __init__(self, index_path="embeddings/faiss_index.bin", metadata_path="embeddings/metadata.pkl"):
        load_dotenv()
        self.index_path = index_path
        self.metadata_path = metadata_path
        
        print("Initializing RAG Engine...")
        
        # Load Embedding Model
        self.embedder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
        
        # Load FAISS Index
        if os.path.exists(self.index_path) and os.path.exists(self.metadata_path):
            self.index = faiss.read_index(self.index_path)
            with open(self.metadata_path, "rb") as f:
                self.metadata = pickle.load(f)
            print(f"Loaded FAISS index with {self.index.ntotal} vectors.")
        else:
            print("Warning: FAISS index not found. RAG will not retrieve context.")
            self.index = None
            self.metadata = []

        # Load LLM
        self.llm = LocalLLM()

    def retrieve(self, query, k=3, threshold=1.2):
        if not self.index:
            return []
        
        query_vector = self.embedder.encode([query]).astype('float32')
        distances, indices = self.index.search(query_vector, k)
        
        results = []
        for i, idx in enumerate(indices[0]):
            if idx != -1 and idx < len(self.metadata):
                # Filter by distance (lower is better for L2)
                if distances[0][i] < threshold:
                    results.append(self.metadata[idx])
        
        return results

    def _format_history(self, history):
        if not history:
            return ""

        formatted_messages = []
        for message in history:
            role = message.get("role", "")
            text = message.get("text", "")
            speaker = "Usuario" if role == "user" else "Inti"
            formatted_messages.append(f"{speaker}: {text}")

        return "\n".join(formatted_messages)

    def query(self, user_query, history=None, stream=False):
        # 0. Check for greetings/chitchat (Simple heuristic)
        greetings = ["hola", "hola!", "buenos dias", "buenas tardes", "buenas noches", "gracias", "adios", "hi", "hello"]
        cleaned_query = user_query.lower().strip().replace("¡", "").replace("!", "")
        
        if cleaned_query in greetings:
            retrieved_docs = []
        else:
            # 1. Retrieve Context
            retrieved_docs = self.retrieve(user_query)
        context_text = "\n\n".join([doc["text"] for doc in retrieved_docs])
        history_text = self._format_history(history)

        persona_message = (
            "Tu nombre es Inti, un asistente educativo en español. "
            "Responde siempre de forma clara, breve y amable, usando ejemplos sencillos."
        )

        # 2. Construct Prompt
        prompt_sections = [persona_message]

        if history_text:
            prompt_sections.append(f"Historial reciente:\n{history_text}")

        if context_text:
            prompt_sections.append(
                "Usa la siguiente información de contexto para responder a la pregunta del usuario.\n"
                "Si la respuesta no está en el contexto, usa tu conocimiento general pero menciónalo.\n"
                "Contexto:\n"
                f"{context_text}"
            )
        else:
            prompt_sections.append(
                "Responde a la siguiente pregunta en un tono didáctico y amable, adecuado para niños o estudiantes."
            )

        prompt_sections.append(f"Pregunta: {user_query}")
        prompt_sections.append("Respuesta:")

        prompt = "\n\n".join(prompt_sections)

        # 3. Generate Response
        response = self.llm.generate_response(prompt, stream=stream)
        
        if stream:
            return response, [doc["source"] for doc in retrieved_docs]

        return {
            "response": response,
            "sources": [doc["source"] for doc in retrieved_docs]
        }

if __name__ == "__main__":
    # Test
    rag = RAGEngine()
    result = rag.query("¿Qué es la fotosíntesis?")
    print("\nRespuesta:", result["response"])
    print("\nFuentes:", result["sources"])
