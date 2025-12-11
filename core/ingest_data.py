import glob
import os
import pickle
from datetime import datetime
from typing import List, Tuple

import faiss
import numpy as np
import PyPDF2
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer

import sys
import os

# Add the project root directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.index_manager import IndexManifest, compute_checksum


class DataIngestor:
    def __init__(
        self,
        data_root: str = "data",
        embeddings_root: str = "embeddings/collections",
        manifest_path: str = "embeddings/index_manifest.json",
    ):
        load_dotenv()
        self.data_root = data_root
        self.embeddings_root = embeddings_root
        self.manifest = IndexManifest(manifest_path)
        self.model_name = "sentence-transformers/all-MiniLM-L6-v2"
        print(f"Loading embedding model: {self.model_name}...")
        self.model = SentenceTransformer(self.model_name)
        self.chunk_size = 500
        self.overlap = 50

    def _load_text_files(self, folder: str) -> List[dict]:
        documents = []
        pdf_files = glob.glob(os.path.join(folder, "*.pdf"))
        txt_files = glob.glob(os.path.join(folder, "*.txt"))

        print(f"[{os.path.basename(folder)}] Found {len(pdf_files)} PDFs and {len(txt_files)} text files.")

        for pdf_file in pdf_files:
            try:
                text = ""
                with open(pdf_file, "rb") as file_handle:
                    reader = PyPDF2.PdfReader(file_handle)
                    for page in reader.pages:
                        text += page.extract_text() + "\n"
                documents.append({"source": pdf_file, "text": text})
            except Exception as exc:  # noqa: BLE001
                print(f"Error reading {pdf_file}: {exc}")

        for txt_file in txt_files:
            try:
                text = ""
                encodings = ["utf-8", "utf-16", "latin-1", "cp1252"]
                for encoding in encodings:
                    try:
                        with open(txt_file, "r", encoding=encoding) as file_handle:
                            text = file_handle.read()
                        break
                    except UnicodeDecodeError:
                        continue

                if text:
                    documents.append({"source": txt_file, "text": text})
                else:
                    print(f"Could not decode {txt_file} with any of {encodings}")

            except Exception as exc:  # noqa: BLE001
                print(f"Error reading {txt_file}: {exc}")

        return documents

    def load_documents(self, subject: str) -> List[dict]:
        subject_dir = os.path.join(self.data_root, subject)
        if not os.path.isdir(subject_dir):
            print(f"No documents found for subject '{subject}' in {subject_dir}")
            return []
        return self._load_text_files(subject_dir)

    def chunk_text(self, text: str) -> List[str]:
        chunks = []
        start = 0
        while start < len(text):
            end = start + self.chunk_size
            chunk = text[start:end]
            chunks.append(chunk)
            start += self.chunk_size - self.overlap
        return chunks

    def _build_embeddings(self, documents: List[dict], subject: str) -> Tuple[faiss.IndexFlatL2, List[dict]]:
        all_chunks: List[str] = []
        all_metadata: List[dict] = []

        print(f"Processing documents and creating chunks for '{subject}'...")
        for doc in documents:
            chunks = self.chunk_text(doc["text"])
            for chunk in chunks:
                all_chunks.append(chunk)
                all_metadata.append({"subject": subject, "source": doc["source"], "text": chunk})

        if not all_chunks:
            raise ValueError(f"No text chunks generated for subject '{subject}'.")

        print(f"Generating embeddings for {len(all_chunks)} chunks...")
        embeddings = self.model.encode(all_chunks)

        dimension = embeddings.shape[1]
        index = faiss.IndexFlatL2(dimension)
        index.add(np.array(embeddings).astype("float32"))
        return index, all_metadata

    def _persist_index(self, subject: str, index: faiss.IndexFlatL2, metadata: List[dict], version: str) -> None:
        subject_dir = os.path.join(self.embeddings_root, subject)
        os.makedirs(subject_dir, exist_ok=True)

        index_path = os.path.join(subject_dir, "faiss_index.bin")
        metadata_path = os.path.join(subject_dir, "metadata.pkl")

        faiss.write_index(index, index_path)
        with open(metadata_path, "wb") as metadata_file:
            pickle.dump(metadata, metadata_file)

        index_size = os.path.getsize(index_path)
        metadata_size = os.path.getsize(metadata_path)

        collection_info = {
            "subject": subject,
            "version": version,
            "vectors": len(metadata),
            "files": {
                "index": index_path,
                "metadata": metadata_path,
            },
            "size_bytes": {
                "index": index_size,
                "metadata": metadata_size,
            },
            "checksums": {
                "index": compute_checksum(index_path),
                "metadata": compute_checksum(metadata_path),
            },
        }

        self.manifest.update_collection(subject, collection_info)
        print(f"Index saved to {index_path}")
        print(f"Metadata saved to {metadata_path}")
        print(f"Manifest updated for '{subject}' with version {version}")

    def create_index(self, subject: str, version: str | None = None) -> None:
        documents = self.load_documents(subject)
        if not documents:
            print(f"No documents found to process for subject '{subject}'.")
            return

        index, metadata = self._build_embeddings(documents, subject)
        resolved_version = version or datetime.utcnow().strftime("%Y.%m.%d")
        self._persist_index(subject, index, metadata, resolved_version)

    def create_indexes_for_subjects(self, subjects: List[str]) -> None:
        for subject in subjects:
            try:
                self.create_index(subject)
            except Exception as exc:  # noqa: BLE001
                print(f"Failed to create index for '{subject}': {exc}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Build FAISS indexes per subject.")
    parser.add_argument("subjects", nargs="+", help="List of subject folders inside the data directory.")
    parser.add_argument("--data-root", default="data", help="Root directory with subject folders.")
    parser.add_argument("--embeddings-root", default="embeddings/collections", help="Where to store FAISS indexes.")
    parser.add_argument("--manifest", default="embeddings/index_manifest.json", help="Manifest path for index metadata.")
    parser.add_argument("--version", default=None, help="Optional version label for the generated indexes.")

    args = parser.parse_args()
    ingestor = DataIngestor(data_root=args.data_root, embeddings_root=args.embeddings_root, manifest_path=args.manifest)

    for subject in args.subjects:
        ingestor.create_index(subject, version=args.version)
