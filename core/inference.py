import os
import glob
from dotenv import load_dotenv

class LocalLLM:
    def __init__(self, model_path=None):
        load_dotenv()
        self.model_path = model_path or os.getenv("LLM_MODEL_PATH")
        if not self.model_path:
            raise ValueError("LLM_MODEL_PATH not set in environment variables")
            
        print(f"Loading model from {self.model_path}...")
        
        # Check if it's a GGUF model (file or directory containing one)
        self.is_gguf = False
        if os.path.isdir(self.model_path):
            gguf_files = glob.glob(os.path.join(self.model_path, "*.gguf"))
            if gguf_files:
                self.model_path = gguf_files[0]
                self.is_gguf = True
        elif self.model_path.endswith(".gguf"):
            self.is_gguf = True

        if self.is_gguf:
            print(f"Detected GGUF model: {self.model_path}")
            try:
                from llama_cpp import Llama
                self.model = Llama(
                    model_path=self.model_path,
                    n_ctx=1024, # Reduced context for speed (sufficient for simple RAG)
                    n_threads=os.cpu_count(),
                    n_batch=512, # Optimized batch size
                    verbose=False
                )
                print("GGUF Model loaded successfully.")
            except ImportError:
                print("Error: llama-cpp-python not installed. Please install it to use GGUF models.")
                raise
            except Exception as e:
                print(f"Error loading GGUF model: {e}")
                raise
        else:
            # Fallback to Transformers
            try:
                import torch
                from transformers import AutoModelForCausalLM, AutoTokenizer
                
                self.tokenizer = AutoTokenizer.from_pretrained(self.model_path)
                self.model = AutoModelForCausalLM.from_pretrained(
                    self.model_path,
                    device_map="cpu", 
                    torch_dtype=torch.float32
                )
                print("Transformers Model loaded successfully.")
            except Exception as e:
                print(f"Error loading model: {e}")
                raise

    def generate_response(self, prompt, max_new_tokens=256, temperature=0.7, stream=False):
        """
        Generates a response for the given prompt. Supports streaming.
        """
        try:
            # Format prompt for Gemma (Instruction tuned)
            formatted_prompt = f"<start_of_turn>user\n{prompt}<end_of_turn>\n<start_of_turn>model\n"
            
            if self.is_gguf:
                output = self.model(
                    formatted_prompt,
                    max_tokens=max_new_tokens,
                    temperature=temperature,
                    stop=["<end_of_turn>"],
                    echo=False,
                    stream=stream
                )
                if stream:
                    return output # Generator
                return output['choices'][0]['text'].strip()
            else:
                inputs = self.tokenizer(formatted_prompt, return_tensors="pt").to("cpu")
                outputs = self.model.generate(
                    **inputs,
                    max_new_tokens=max_new_tokens,
                    temperature=temperature,
                    do_sample=True,
                    top_p=0.95,
                    repetition_penalty=1.1
                )
                generated_tokens = outputs[0][inputs.input_ids.shape[1]:]
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
