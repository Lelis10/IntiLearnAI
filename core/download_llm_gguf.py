import hashlib
import os
from dataclasses import dataclass
from typing import Optional

from dotenv import load_dotenv
from huggingface_hub import hf_hub_download


@dataclass
class GGUFModelConfig:
    name: str
    repo_id: str
    filename: str
    env_var: str
    default_dir: str
    expected_sha256: Optional[str] = None


MODEL_OPTIONS = {
    "primary": GGUFModelConfig(
        name="Gemma 2B Instruct Q4_K_M",
        repo_id="bartowski/gemma-2-2b-it-GGUF",
        filename="gemma-2-2b-it-Q4_K_M.gguf",
        env_var="LLM_MODEL_PATH",
        default_dir="models/gemma-2-2b-it-gguf",
        expected_sha256=None,  # Provide if you want strict checksum validation
    ),
    "fallback": GGUFModelConfig(
        name="Gemma 1.1B Instruct Q4_K_M",
        repo_id="bartowski/gemma-2-1.1b-it-GGUF",
        filename="gemma-2-1.1b-it-Q4_K_M.gguf",
        env_var="LLM_FALLBACK_MODEL_PATH",
        default_dir="models/gemma-2-1.1b-it-gguf",
        expected_sha256=None,
    ),
}


def _sha256sum(path: str) -> str:
    hash_obj = hashlib.sha256()
    with open(path, "rb") as file:
        for chunk in iter(lambda: file.read(8192), b""):
            hash_obj.update(chunk)
    return hash_obj.hexdigest()


def _validate_integrity(path: str, expected_sha256: Optional[str] = None, min_bytes: int = 5_000_000) -> bool:
    """Basic integrity validation for downloaded models."""
    file_size = os.path.getsize(path)
    if file_size < min_bytes:
        raise ValueError(f"Downloaded file is too small ({file_size} bytes).")

    calculated_hash = _sha256sum(path)
    if expected_sha256 and calculated_hash != expected_sha256:
        raise ValueError(
            "Checksum mismatch: expected "
            f"{expected_sha256} but got {calculated_hash}"
        )

    print(f"Integrity check passed (sha256: {calculated_hash}).")
    return True


def download_gguf_model(target: str = "primary") -> str:
    load_dotenv()
    config = MODEL_OPTIONS.get(target)

    if not config:
        raise ValueError(f"Unknown target '{target}'. Valid options: {list(MODEL_OPTIONS)}")

    save_dir = os.getenv(config.env_var, config.default_dir)
    os.makedirs(save_dir, exist_ok=True)

    print(f"Downloading {config.name} from {config.repo_id} ({config.filename})...")

    expected_hash = os.getenv(f"{config.env_var}_SHA256", config.expected_sha256)
    try:
        model_path = hf_hub_download(
            repo_id=config.repo_id,
            filename=config.filename,
            local_dir=save_dir,
            local_dir_use_symlinks=False,
            resume_download=True,
        )
        _validate_integrity(model_path, expected_hash)
        print(f"Model downloaded to: {model_path}")
        return model_path
    except Exception as exc:
        raise RuntimeError(f"Failed to download {config.name}: {exc}") from exc


if __name__ == "__main__":
    primary_path = download_gguf_model("primary")
    print(f"Primary model ready at: {primary_path}")

    fallback_path = download_gguf_model("fallback")
    print(f"Fallback model ready at: {fallback_path}")
