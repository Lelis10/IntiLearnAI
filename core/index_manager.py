import hashlib
import json
import os
import zipfile
from typing import Dict, Optional


def compute_checksum(file_path: str) -> str:
    hash_sha = hashlib.sha256()
    with open(file_path, "rb") as file_handle:
        for chunk in iter(lambda: file_handle.read(4096), b""):
            hash_sha.update(chunk)
    return hash_sha.hexdigest()


class IndexManifest:
    def __init__(self, manifest_path: str = "embeddings/index_manifest.json"):
        self.manifest_path = manifest_path
        self.data: Dict = {"collections": {}, "base_bundle_version": None}
        self.load()

    def load(self) -> None:
        if os.path.exists(self.manifest_path):
            with open(self.manifest_path, "r", encoding="utf-8") as manifest_file:
                self.data = json.load(manifest_file)

    def save(self) -> None:
        os.makedirs(os.path.dirname(self.manifest_path), exist_ok=True)
        with open(self.manifest_path, "w", encoding="utf-8") as manifest_file:
            json.dump(self.data, manifest_file, indent=2, ensure_ascii=False)

    def update_collection(self, subject: str, info: Dict) -> None:
        self.data.setdefault("collections", {})[subject] = info
        self.save()

    def get_collection(self, subject: str) -> Optional[Dict]:
        return self.data.get("collections", {}).get(subject)

    def reload(self) -> None:
        self.load()


class IndexStore:
    def __init__(
        self,
        embeddings_root: str = "embeddings/collections",
        manifest_path: str = "embeddings/index_manifest.json",
        base_bundle: Optional[str] = None,
        subject_bundle_dir: Optional[str] = None,
    ):
        self.embeddings_root = embeddings_root
        self.manifest = IndexManifest(manifest_path)
        self.base_bundle = base_bundle or os.getenv("INDEX_BASE_BUNDLE")
        self.subject_bundle_dir = subject_bundle_dir or os.getenv("INDEX_SUBJECT_BUNDLE_DIR")

    def _extract_bundle(self, bundle_path: Optional[str]) -> bool:
        if not bundle_path or not os.path.exists(bundle_path):
            return False

        target_dir = os.path.dirname(self.embeddings_root)
        with zipfile.ZipFile(bundle_path, "r") as bundle:
            bundle.extractall(target_dir)
        self.manifest.reload()
        return True

    def _verify_collection_files(self, info: Dict) -> bool:
        index_path = info["files"]["index"]
        metadata_path = info["files"]["metadata"]

        if not os.path.exists(index_path) or not os.path.exists(metadata_path):
            return False

        expected_checksums = info.get("checksums", {})
        index_matches = not expected_checksums or compute_checksum(index_path) == expected_checksums.get("index")
        metadata_matches = not expected_checksums or compute_checksum(metadata_path) == expected_checksums.get("metadata")
        return index_matches and metadata_matches

    def install_from_bundles(self, subject: str) -> bool:
        installed = self._extract_bundle(self.base_bundle)

        if self.subject_bundle_dir:
            subject_bundle_path = os.path.join(self.subject_bundle_dir, f"{subject}.zip")
            installed = self._extract_bundle(subject_bundle_path) or installed

        return installed

    def ensure_collection(self, subject: str, auto_install: bool = True) -> Dict:
        info = self.manifest.get_collection(subject)
        if info and self._verify_collection_files(info):
            return info

        if auto_install:
            if self.install_from_bundles(subject):
                info = self.manifest.get_collection(subject)
                if info and self._verify_collection_files(info):
                    return info

        raise FileNotFoundError(f"Collection '{subject}' is not available locally and could not be installed.")
