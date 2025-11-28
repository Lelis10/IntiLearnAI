import os
import faiss
import pickle
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from PyPDF2 import PdfReader

load_dotenv()

class RAGSystem:
    def __init__(self):
        self.embedder = SentenceTransformer(os.getenv("EMBEDDINGS_MODEL_NAME"))
        self.index_path = os.getenv("FAISS_INDEX_PATH")
        self.metadata_path = self.index_path.replace('.faiss', '_metadata.pkl')
        self.data_path = os.getenv("DATA_PATH")
        self.index = None
        self.documents = []
        self.load_or_build_index()

    def extract_text_from_pdfs(self):
        texts = []
        for filename in os.listdir(self.data_path):
            if filename.endswith(".pdf"):
                reader = PdfReader(os.path.join(self.data_path, filename))
                text = ""
                for page in reader.pages:
                    text += page.extract_text() + "\n"
                texts.append(text)
        return texts

    def build_index(self):
        self.documents = self.extract_text_from_pdfs()
        embeddings = self.embedder.encode(self.documents)
        dimension = embeddings.shape[1]
        self.index = faiss.IndexFlatL2(dimension)
        self.index.add(embeddings.astype('float32'))
        faiss.write_index(self.index, self.index_path)
        with open(self.metadata_path, 'wb') as f:
            pickle.dump(self.documents, f)
        print("Índice FAISS creado.")

    def load_or_build_index(self):
        if os.path.exists(self.index_path) and os.path.exists(self.metadata_path):
            self.index = faiss.read_index(self.index_path)
            with open(self.metadata_path, 'rb') as f:
                self.documents = pickle.load(f)
            print("Índice FAISS cargado.")
        else:
            self.build_index()

    def retrieve(self, query, top_k=3):
        query_emb = self.embedder.encode([query])
        distances, indices = self.index.search(query_emb.astype('float32'), top_k)
        return [self.documents[i] for i in indices[0]]

if __name__ == "__main__":
    rag = RAGSystem()
    results = rag.retrieve("Explica las fracciones en matemáticas")
    print("Resultados RAG:", results)