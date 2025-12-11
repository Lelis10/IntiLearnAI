import os
import pickle
from functools import lru_cache
from typing import Dict, List, Optional, Tuple

import faiss
import numpy as np
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer

from core.index_manager import IndexStore
from core.inference import LocalLLM


class EmbeddingCache:
    def __init__(self, model: SentenceTransformer, cache_size: int = 2048):
        self.model = model

        @lru_cache(maxsize=cache_size)
        def cached_encode(text: str):
            return self.model.encode([text], convert_to_numpy=True)[0].astype("float32")

        self._cached_encode = cached_encode

    def encode(self, texts: List[str]):
        if isinstance(texts, str):
            texts = [texts]
        return np.stack([self._cached_encode(text) for text in texts], axis=0)


class RAGEngine:
    def __init__(
        self,
        embeddings_root: str = "embeddings/collections",
        manifest_path: str = "embeddings/index_manifest.json",
        default_subject: Optional[str] = None,
    ):
        load_dotenv()
        self.default_subject = default_subject or os.getenv("DEFAULT_SUBJECT_COLLECTION", "base")
        resolved_embeddings_root = os.getenv("EMBEDDINGS_ROOT", embeddings_root)
        resolved_manifest_path = os.getenv("EMBEDDINGS_MANIFEST", manifest_path)
        data_root = os.getenv("INDEX_DATA_ROOT", "data")
        self.index_store = IndexStore(
            embeddings_root=resolved_embeddings_root,
            manifest_path=resolved_manifest_path,
            data_root=data_root,
        )

        print("Initializing RAG Engine...")

        self.embedder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
        self.embedding_cache = EmbeddingCache(self.embedder)
        self.loaded_indexes: Dict[str, Tuple[faiss.IndexFlatL2, List[dict]]] = {}
        self.llm = LocalLLM()
        # Warm embedding cache to speed up first retrieval
        self.embedding_cache.encode(["Warmup embedding"])

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

        query_vector = self.embedding_cache.encode([query])
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

        if subject == "Ingles":
            persona_message = (
                "You are Inti, a helpful English tutor. "
                "Always respond in English. Keep your answers clear, short, and friendly. "
                "Use simple examples suitable for students."
            )
            subject_line = "Subject: English"
        else:
            persona_message = (
                "Tu nombre es Inti, un asistente educativo en español. "
                "Responde siempre de forma clara, breve y amable, usando ejemplos sencillos."
            )
            subject_line = f"Materia seleccionada: {subject}" if subject else "Materia seleccionada: general"

        prompt_sections = [persona_message, subject_line]

        if history_text:
            prompt_sections.append(f"Historial reciente:\n{history_text}")

        if context_text:
            if subject == "Ingles":
                prompt_sections.append(
                    "Use the following context to answer the user's question.\n"
                    "If the answer is not in the context, use your general knowledge but mention it.\n"
                    "Context:\n"
                    f"{context_text}"
                )
            else:
                prompt_sections.append(
                    "Usa la siguiente información de contexto para responder a la pregunta del usuario.\n"
                    "Si la respuesta no está en el contexto, usa tu conocimiento general pero menciónalo.\n"
                    "Contexto:\n"
                    f"{context_text}"
                )
        else:
            if subject == "Ingles":
                prompt_sections.append(
                    "Answer the following question in a friendly and educational tone."
                )
            else:
                prompt_sections.append(
                    "Responde a la siguiente pregunta en un tono didáctico y amable, adecuado para niños o estudiantes."
                )

        prompt_sections.append(f"Pregunta: {user_query}")
        prompt_sections.append("Respuesta:")

        return "\n\n".join(prompt_sections)

    def detect_subject(self, query: str) -> Optional[str]:
        """
        Uses the LLM to classify the query into one of the available subjects.
        Returns the subject name if confident, else None.
        """
        subjects = ["Matematicas", "Fisica", "Lengua", "Historia", "Filosofia", "Ingles"]
        subjects_str = ", ".join(subjects)
        
        prompt = (
            f"Clasifica la siguiente pregunta en una de estas materias: {subjects_str}.\n"
            "Usa las siguientes definiciones como guía:\n"
            "- Matematicas: números, ecuaciones, geometría, cálculo, álgebra.\n"
            "- Fisica: movimiento, fuerzas, energía, ondas, electricidad, velocidad, tiempo.\n"
            "- Lengua: gramática, ortografía, literatura, análisis de textos, poemas.\n"
            "- Historia: eventos pasados, personajes históricos, fechas, guerras, civilizaciones.\n"
            "- Filosofia: pensamiento, ética, moral, existencia, filósofos, sentido de la vida.\n"
            "- Ingles: aprender inglés, traducciones al inglés, vocabulario en inglés, 'cómo se dice'.\n\n"
            "- None: Si la pregunta es un saludo o despedida.\n"
            "Ejemplos:\n"
            "Pregunta: ¿Cómo se dice perro en inglés? -> Materia: Ingles\n"
            "Pregunta: Calcula la derivada de x. -> Materia: Matematicas\n"
            "Pregunta: ¿Qué es el ser? -> Materia: Filosofia\n"
            "Pregunta: Hola, ¿cómo estás? -> Materia: None\n\n"
            "Si no encaja claramente en ninguna, responde 'None'.\n"
            "Responde ÚNICAMENTE con el nombre de la materia o 'None'.\n\n"
            f"Pregunta: {query}\n"
            "Materia:"
        )
        
        # Use a non-streaming call for classification
        response = self.llm.generate_response(prompt, stream=False)
        
        # Normalize: remove accents and lower case for comparison
        import unicodedata
        def remove_accents(input_str):
            nfkd_form = unicodedata.normalize('NFKD', input_str)
            return "".join([c for c in nfkd_form if not unicodedata.combining(c)])

        cleaned_response = remove_accents(response.strip().replace(".", ""))
        
        # Check against subjects (also normalized if needed, but they are ASCII here)
        if cleaned_response in subjects:
            return cleaned_response
        return None

    def query(self, user_query: str, subject: Optional[str] = None, history: Optional[List[dict]] = None, stream: bool = False):
        greetings = ["hola", "hola!", "buenos dias", "buenas tardes", "buenas noches", "gracias", "adios", "hi", "hello"]
        cleaned_query = user_query.lower().strip().replace("¡", "").replace("!", "")
        selected_subject = self._select_collection(subject)
        
        suggested_subject = None

        if cleaned_query in greetings:
            retrieved_docs: List[dict] = []
        else:
            # Subject detection logic
            detected_subject = self.detect_subject(user_query)
            if detected_subject and detected_subject != selected_subject:
                suggested_subject = detected_subject

            retrieved_docs = self.retrieve(user_query, subject=selected_subject)

        prompt = self._build_prompt(user_query, selected_subject, retrieved_docs, history)
        response = self.llm.generate_response(prompt, stream=stream)

        sources = [doc.get("source") for doc in retrieved_docs]

        if stream:
            return response, sources, suggested_subject

        return {
            "response": response,
            "sources": sources,
            "suggested_subject": suggested_subject
        }


if __name__ == "__main__":
    rag = RAGEngine()
    result = rag.query("¿Qué es la fotosíntesis?", subject="biologia")
    print("\nRespuesta:", result["response"])
    print("\nFuentes:", result["sources"])
