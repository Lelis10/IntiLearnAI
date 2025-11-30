import glob
import os
from dataclasses import dataclass
from typing import Optional, Tuple

import psutil
from dotenv import load_dotenv


@dataclass
class SystemCapabilities:
    total_ram_gb: float
    cpu_count: int
    has_gpu: bool
    gpu_mem_gb: float


class LocalLLM:
    """Load a local LLM choosing between primary and fallback models automatically."""

    DEFAULT_PRIMARY_PATH = "models/gemma-2-2b-it-gguf"
    DEFAULT_FALLBACK_PATH = "models/gemma-2-1.1b-it-gguf"

    def __init__(self, model_path: Optional[str] = None, fallback_model_path: Optional[str] = None):
        load_dotenv()
        self.primary_model_path = model_path or os.getenv("LLM_MODEL_PATH", self.DEFAULT_PRIMARY_PATH)
        self.fallback_model_path = fallback_model_path or os.getenv(
            "LLM_FALLBACK_MODEL_PATH", self.DEFAULT_FALLBACK_PATH
        )

        self.model_path, self.is_gguf, self.model_tier = self._select_model_path()
        print(f"Loading {self.model_tier} model from {self.model_path}...")

        if self.is_gguf:
            self._load_gguf_model()
        else:
            self._load_transformers_model()

    def _detect_system_capabilities(self) -> SystemCapabilities:
        gpu_mem = 0.0
        has_gpu = False
        try:
            import torch

            has_gpu = torch.cuda.is_available()
            if has_gpu:
                gpu_properties = torch.cuda.get_device_properties(0)
                gpu_mem = round(gpu_properties.total_memory / (1024 ** 3), 2)
        except Exception:
            has_gpu = False
            gpu_mem = 0.0

        total_ram_gb = round(psutil.virtual_memory().total / (1024 ** 3), 2)
        cpu_count = psutil.cpu_count(logical=True) or 1
        return SystemCapabilities(total_ram_gb=total_ram_gb, cpu_count=cpu_count, has_gpu=has_gpu, gpu_mem_gb=gpu_mem)

    def _resolve_model_path(self, path: str) -> Tuple[str, bool]:
        if not path:
            raise ValueError("Model path is not configured.")

        is_gguf = False
        resolved_path = path
        if os.path.exists(path):
            if os.path.isdir(path):
                gguf_files = glob.glob(os.path.join(path, "*.gguf"))
                if gguf_files:
                    resolved_path = gguf_files[0]
                    is_gguf = True
            elif path.endswith(".gguf"):
                is_gguf = True

            file_size = os.path.getsize(resolved_path)
            if file_size == 0:
                raise ValueError(f"Model file at {resolved_path} is empty.")
        else:
            # Allow remote repositories (e.g., Hugging Face IDs) to be passed
            # directly to transformers, which will download lazily.
            is_gguf = path.endswith(".gguf")

        return resolved_path, is_gguf

    def _select_model_path(self) -> Tuple[str, bool, str]:
        capabilities = self._detect_system_capabilities()
        print(
            "Hardware detectado: "
            f"RAM={capabilities.total_ram_gb}GB, CPUs={capabilities.cpu_count}, "
            f"GPU={'sí' if capabilities.has_gpu else 'no'} (mem={capabilities.gpu_mem_gb}GB)"
        )

        primary_candidate = None
        fallback_candidate = None

        try:
            primary_candidate = self._resolve_model_path(self.primary_model_path)
        except Exception as exc:
            print(f"Modelo principal no disponible: {exc}")

        try:
            fallback_candidate = self._resolve_model_path(self.fallback_model_path)
        except Exception as exc:
            print(f"Modelo fallback no disponible: {exc}")

        if not primary_candidate and not fallback_candidate:
            raise FileNotFoundError("No se encontró ni el modelo principal ni el fallback. Descarga los GGUF primero.")

        # Prefer primary if system has enough memory (>=8GB RAM or >=4GB GPU).
        if primary_candidate:
            if capabilities.total_ram_gb >= 8 or capabilities.gpu_mem_gb >= 4:
                return (*primary_candidate, "modelo principal")
            print("Recurso limitado: usando fallback por baja memoria.")

        if fallback_candidate:
            return (*fallback_candidate, "modelo fallback")

        # If only primary exists but resources are limited, still attempt but warn.
        print("Usando modelo principal aun con recursos limitados. Puede ser lento o inestable.")
        return (*primary_candidate, "modelo principal")

    def _load_gguf_model(self):
        try:
            from llama_cpp import Llama

            self.model = Llama(
                model_path=self.model_path,
                n_ctx=1024,
                n_threads=os.cpu_count(),
                n_batch=512,
                verbose=False,
            )
            print("GGUF model loaded successfully.")
        except ImportError as exc:
            raise ImportError("llama-cpp-python no está instalado. Requerido para modelos GGUF.") from exc
        except Exception as exc:
            raise RuntimeError(f"Error al cargar el modelo GGUF: {exc}") from exc

    def _load_transformers_model(self):
        try:
            import torch
            from transformers import AutoModelForCausalLM, AutoTokenizer

            self.tokenizer = AutoTokenizer.from_pretrained(self.model_path)
            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_path, device_map="cpu", torch_dtype=torch.float32
            )
            print("Transformers model loaded successfully.")
        except Exception as exc:
            raise RuntimeError(f"Error al cargar el modelo Transformers: {exc}") from exc

    def generate_response(self, prompt, max_new_tokens=256, temperature=0.7, stream=False):
        """Generates a response for the given prompt. Supports streaming."""
        try:
            formatted_prompt = f"<start_of_turn>user\n{prompt}<end_of_turn>\n<start_of_turn>model\n"

            if hasattr(self, "model") and self.is_gguf:
                output = self.model(
                    formatted_prompt,
                    max_tokens=max_new_tokens,
                    temperature=temperature,
                    stop=["<end_of_turn>"],
                    echo=False,
                    stream=stream,
                )
                if stream:
                    return output
                return output["choices"][0]["text"].strip()

            inputs = self.tokenizer(formatted_prompt, return_tensors="pt").to("cpu")
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                temperature=temperature,
                do_sample=True,
                top_p=0.95,
                repetition_penalty=1.1,
            )
            generated_tokens = outputs[0][inputs.input_ids.shape[1] :]
            response = self.tokenizer.decode(generated_tokens, skip_special_tokens=True)
            return response.strip()

        except Exception as exc:
            return f"Error generating response: {exc}"


if __name__ == "__main__":
    try:
        llm = LocalLLM()
        response = llm.generate_response(
            "Hola, explícame qué es la fotosíntesis como si fuera un niño de 8 años."
        )
        print("\nResponse:\n", response)
    except Exception as exc:
        print(f"Setup failed: {exc}")
