import os
import glob
import PyPDF2
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
import pickle
from dotenv import load_dotenv

class DataIngestor:
    def __init__(self, data_dir="data", index_path="embeddings/faiss_index.bin", metadata_path="embeddings/metadata.pkl"):
        load_dotenv()
        self.data_dir = data_dir
        self.index_path = index_path
        self.metadata_path = metadata_path
        self.model_name = "sentence-transformers/all-MiniLM-L6-v2"
        print(f"Loading embedding model: {self.model_name}...")
        self.model = SentenceTransformer(self.model_name)
        self.chunk_size = 500  # Characters
        self.overlap = 50

    def load_documents(self):
        documents = []
        pdf_files = glob.glob(os.path.join(self.data_dir, "*.pdf"))
        txt_files = glob.glob(os.path.join(self.data_dir, "*.txt"))
        
        print(f"Found {len(pdf_files)} PDFs and {len(txt_files)} text files.")

        for pdf_file in pdf_files:
            try:
                text = ""
                with open(pdf_file, "rb") as f:
                    reader = PyPDF2.PdfReader(f)
                    for page in reader.pages:
                        text += page.extract_text() + "\n"
                documents.append({"source": pdf_file, "text": text})
            except Exception as e:
                print(f"Error reading {pdf_file}: {e}")

        for txt_file in txt_files:
            try:
                text = ""
                encodings = ['utf-8', 'utf-16', 'latin-1', 'cp1252']
                for enc in encodings:
                    try:
                        with open(txt_file, "r", encoding=enc) as f:
                            text = f.read()
                        break
                    except UnicodeDecodeError:
                        continue
                
                if text:
                    documents.append({"source": txt_file, "text": text})
                else:
                    print(f"Could not decode {txt_file} with any of {encodings}")

            except Exception as e:
                print(f"Error reading {txt_file}: {e}")
        
        return documents

    def chunk_text(self, text):
        chunks = []
        start = 0
        while start < len(text):
            end = start + self.chunk_size
            chunk = text[start:end]
            chunks.append(chunk)
            start += self.chunk_size - self.overlap
        return chunks

    def create_index(self):
        documents = self.load_documents()
        if not documents:
            print("No documents found to process.")
            return

        all_chunks = []
        all_metadata = []

        print("Processing documents and creating chunks...")
        for doc in documents:
            chunks = self.chunk_text(doc["text"])
            for chunk in chunks:
                all_chunks.append(chunk)
                all_metadata.append({"source": doc["source"], "text": chunk})

        print(f"Generating embeddings for {len(all_chunks)} chunks...")
        embeddings = self.model.encode(all_chunks)
        
        # Create FAISS index
        dimension = embeddings.shape[1]
        index = faiss.IndexFlatL2(dimension)
        index.add(np.array(embeddings).astype('float32'))
        
        # Save index and metadata
        os.makedirs(os.path.dirname(self.index_path), exist_ok=True)
        faiss.write_index(index, self.index_path)
        with open(self.metadata_path, "wb") as f:
            pickle.dump(all_metadata, f)
            
        print(f"Index saved to {self.index_path}")
        print(f"Metadata saved to {self.metadata_path}")

if __name__ == "__main__":
    ingestor = DataIngestor()
    ingestor.create_index()
