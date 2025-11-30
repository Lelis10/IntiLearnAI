import os
import pickle
from typing import Dict, List, Optional, Tuple

import faiss
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer

from core.index_manager import IndexStore
from core.inference import LocalLLM


class RAGEngine:
    def __init__(
        self,
        embeddings_root: str = "embeddings/collections",
        manifest_path: str = "embeddings/index_manifest.json",
        default_subject: Optional[str] = None,
    ):
        load_dotenv()
        self.default_subject = default_subject or os.getenv("DEFAULT_SUBJECT_COLLECTION", "base")
        self.index_store = IndexStore(embeddings_root=embeddings_root, manifest_path=manifest_path)

        print("Initializing RAG Engine...")

        self.embedder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
        self.loaded_indexes: Dict[str, Tuple[faiss.IndexFlatL2, List[dict]]] = {}
        self.llm = LocalLLM()

    def _load_collection(self, subject: str) -> Tuple[faiss.IndexFlatL2, List[dict]]:
        if subject in self.loaded_indexes:
            return self.loaded_indexes[subject]

        collection_info = self.index_store.ensure_collection(subject)
        index_path = collection_info["files"]["index"]
        metadata_path = collection_info["files"]["metadata"]

        index = faiss.read_index(index_path)
        with open(metadata_path, "rb") as metadata_file:
            metadata = pickle.load(metadata_file)

        self.loaded_indexes[subject] = (index, metadata)
        print(f"Loaded FAISS index for '{subject}' with {index.ntotal} vectors.")
        return index, metadata

    def _select_collection(self, subject: Optional[str]) -> str:
        return subject or self.default_subject

    def retrieve(self, query: str, subject: Optional[str] = None, k: int = 3, threshold: float = 1.2) -> List[dict]:
        selected_subject = self._select_collection(subject)

        try:
            index, metadata = self._load_collection(selected_subject)
        except FileNotFoundError:
            if selected_subject != self.default_subject:
                index, metadata = self._load_collection(self.default_subject)
            else:
                return []

        query_vector = self.embedder.encode([query]).astype("float32")
        distances, indices = index.search(query_vector, k)

        results = []
        for position, idx in enumerate(indices[0]):
            if idx != -1 and idx < len(metadata):
                if distances[0][position] < threshold:
                    results.append(metadata[idx])

        return results

    def _format_history(self, history: Optional[List[dict]]) -> str:
        if not history:
            return ""

        formatted_messages = []
        for message in history:
            role = message.get("role", "")
            text = message.get("text", "")
            speaker = "Usuario" if role == "user" else "Inti"
            formatted_messages.append(f"{speaker}: {text}")

        return "\n".join(formatted_messages)

    def _build_prompt(self, user_query: str, subject: str, retrieved_docs: List[dict], history: Optional[List[dict]]) -> str:
        context_text = "\n\n".join([doc["text"] for doc in retrieved_docs])
        history_text = self._format_history(history)

        persona_message = (
            "Tu nombre es Inti, un asistente educativo en español. "
            "Responde siempre de forma clara, breve y amable, usando ejemplos sencillos."
        )

        subject_line = f"Materia seleccionada: {subject}" if subject else "Materia seleccionada: general"

        prompt_sections = [persona_message, subject_line]

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

        return "\n\n".join(prompt_sections)

    def query(self, user_query: str, subject: Optional[str] = None, history: Optional[List[dict]] = None, stream: bool = False):
        greetings = ["hola", "hola!", "buenos dias", "buenas tardes", "buenas noches", "gracias", "adios", "hi", "hello"]
        cleaned_query = user_query.lower().strip().replace("¡", "").replace("!", "")
        selected_subject = self._select_collection(subject)

        if cleaned_query in greetings:
            retrieved_docs: List[dict] = []
        else:
            retrieved_docs = self.retrieve(user_query, subject=selected_subject)

        prompt = self._build_prompt(user_query, selected_subject, retrieved_docs, history)
        response = self.llm.generate_response(prompt, stream=stream)

        sources = [doc.get("source") for doc in retrieved_docs]

        if stream:
            return response, sources

        return {
            "response": response,
            "sources": sources,
        }


if __name__ == "__main__":
    rag = RAGEngine()
    result = rag.query("¿Qué es la fotosíntesis?", subject="biologia")
    print("\nRespuesta:", result["response"])
    print("\nFuentes:", result["sources"])
