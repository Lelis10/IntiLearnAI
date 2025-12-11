import glob
import os
import sys
from functools import lru_cache
from typing import Any, Dict, Optional

import torch
from dotenv import load_dotenv

# Add the project root directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class LocalLLM:
    def __init__(self, model_path: Optional[str] = None):
        load_dotenv()
        self.model_path = model_path or os.getenv("LLM_MODEL_PATH")
        if not self.model_path:
            raise ValueError("LLM_MODEL_PATH not set in environment variables")

        self.runtime = os.getenv("LLM_RUNTIME")
        self.prompt_cache: Dict[str, bool] = {}

        print(f"Loading model from {self.model_path}...")

        # Detect quantized GGUF models automatically unless runtime is forced
        self.is_gguf = False
        if not self.runtime or self.runtime == "gguf":
            if os.path.isdir(self.model_path):
                gguf_files = glob.glob(os.path.join(self.model_path, "*.gguf"))
                if gguf_files:
                    self.model_path = gguf_files[0]
                    self.is_gguf = True
            elif self.model_path.endswith(".gguf"):
                self.is_gguf = True

        if self.is_gguf:
            self.runtime = "gguf"
            self._init_gguf_model()
        elif self.runtime == "onnx":
            self._init_onnx_runtime()
        else:
            # Default to Transformers runtime with hardware acceleration if available
            self.runtime = "transformers"
            self._init_transformers_model()

        self._prewarm_model()

    def _resolve_device(self) -> str:
        explicit_device = os.getenv("LLM_DEVICE")
        if explicit_device:
            normalized = explicit_device.lower()
            if normalized in {"auto", "gpu"}:
                if torch.cuda.is_available():
                    return "cuda"
                if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                    return "mps"
                try:
                    import torch_directml  # type: ignore

                    return str(torch_directml.device())
                except Exception:
                    pass

                return "cpu"

            return explicit_device

        if torch.cuda.is_available():
            return "cuda"

        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return "mps"

        try:
            import torch_directml  # type: ignore

            return str(torch_directml.device())
        except Exception:
            pass

        return "cpu"

    def _init_gguf_model(self) -> None:
        print(f"Detected GGUF model: {self.model_path}")
        try:
            from llama_cpp import Llama

            batch_size = int(os.getenv("LLM_BATCH_SIZE", "512"))
            context_size = int(os.getenv("LLM_CONTEXT_SIZE", "1024"))
            self.model = Llama(
                model_path=self.model_path,
                n_ctx=context_size,
                n_threads=os.cpu_count(),
                n_batch=batch_size,
                verbose=False,
            )
            print("GGUF Model loaded successfully using llama.cpp runtime.")
        except ImportError:
            print("Error: llama-cpp-python not installed. Please install it to use GGUF models.")
            raise
        except Exception as e:
            print(f"Error loading GGUF model: {e}")
            raise

    def _init_transformers_model(self) -> None:
        try:
            from transformers import AutoModelForCausalLM, AutoTokenizer

            quantization_mode = os.getenv("LLM_QUANTIZATION", "none").lower()
            self.device = self._resolve_device()
            dtype = torch.float16 if self.device != "cpu" else torch.float32

            tokenizer_kwargs: Dict[str, Any] = {}
            model_kwargs: Dict[str, Any] = {
                "device_map": "auto" if self.device != "cpu" else {"": "cpu"},
                "torch_dtype": dtype,
            }

            if quantization_mode in {"4bit", "8bit"}:
                try:
                    from transformers import BitsAndBytesConfig

                    model_kwargs["quantization_config"] = BitsAndBytesConfig(
                        load_in_4bit=quantization_mode == "4bit",
                        load_in_8bit=quantization_mode == "8bit",
                        llm_int8_enable_fp32_cpu_offload=self.device == "cpu",
                        bnb_4bit_compute_dtype=dtype,
                    )
                    print(f"Quantization enabled: {quantization_mode}")
                except ImportError:
                    print("bitsandbytes not available; continuing without quantization.")

            self.tokenizer = AutoTokenizer.from_pretrained(self.model_path, **tokenizer_kwargs)
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token

            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_path,
                **model_kwargs,
            )
            print(f"Transformers Model loaded on {self.device} runtime.")
        except Exception as e:
            print(f"Error loading model: {e}")
            raise

        @lru_cache(maxsize=256)
        def _cached_tokenize(prompt: str):
            return self.tokenizer(prompt, return_tensors="pt")

        self._cached_tokenize = _cached_tokenize

    def _init_onnx_runtime(self) -> None:
        try:
            from optimum.onnxruntime import ORTModelForCausalLM
            from transformers import AutoTokenizer

            self.device = os.getenv("LLM_DEVICE", "cpu")
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_path)
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token

            self.model = ORTModelForCausalLM.from_pretrained(self.model_path)
            print("ONNX Runtime model loaded.")
        except Exception as e:
            print(f"Falling back to Transformers runtime: {e}")
            self.runtime = "transformers"
            self._init_transformers_model()
            return

        @lru_cache(maxsize=256)
        def _cached_tokenize(prompt: str):
            return self.tokenizer(prompt, return_tensors="pt")

        self._cached_tokenize = _cached_tokenize

    def _prewarm_model(self) -> None:
        warmup_prompt = os.getenv(
            "LLM_WARMUP_PROMPT",
            "Hola, ¿puedes confirmar que estás listo?",
        )
        try:
            _ = self.generate_response(
                warmup_prompt,
                max_new_tokens=8,
                temperature=0.0,
                stream=False,
                use_prompt_cache=True,
            )
            print("Model pre-warmed.")
        except Exception as exc:  # pragma: no cover - safety net
            print(f"Warmup skipped due to error: {exc}")

    def generate_response(self, prompt, max_new_tokens=256, temperature=0.7, stream=False, use_prompt_cache: bool = True):
        """
        Generates a response for the given prompt. Supports streaming and prompt caching
        where the runtime supports KV reuse (llama.cpp).
        """
        try:
            formatted_prompt = f"<start_of_turn>user\n{prompt}<end_of_turn>\n<start_of_turn>model\n"

            if self.runtime == "gguf":
                cache_prompt = use_prompt_cache and formatted_prompt in self.prompt_cache
                output = self.model(
                    formatted_prompt,
                    max_tokens=max_new_tokens,
                    temperature=temperature,
                    stop=["<end_of_turn>"],
                    echo=False,
                    stream=stream,
                )
                if not cache_prompt and use_prompt_cache:
                    self.prompt_cache[formatted_prompt] = True

                if stream:
                    return output  # Generator
                return output["choices"][0]["text"].strip()

            inputs = self._cached_tokenize(formatted_prompt)
            input_ids = inputs["input_ids"].to(self.device)
            attention_mask = inputs.get("attention_mask")
            if attention_mask is not None:
                attention_mask = attention_mask.to(self.device)

            with torch.inference_mode():
                outputs = self.model.generate(
                    input_ids=input_ids,
                    attention_mask=attention_mask,
                    max_new_tokens=max_new_tokens,
                    temperature=temperature,
                    do_sample=True,
                    top_p=0.95,
                    repetition_penalty=1.1,
                    use_cache=True,
                )
            generated_tokens = outputs[0][input_ids.shape[1] :]
            response = self.tokenizer.decode(generated_tokens, skip_special_tokens=True)
            return response.strip()

        except Exception as e:
            return f"Error generating response: {e}"

if __name__ == "__main__":
    # Simple test
    try:
        llm = LocalLLM()
        response = llm.generate_response("Hola, explícame qué es la fotosíntesis como si fuera un niño de 8 años.")
        print("\nResponse:\n", response)
    except Exception as e:
        print(f"Setup failed: {e}")
