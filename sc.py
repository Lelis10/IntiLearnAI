import os
from dotenv import load_dotenv
load_dotenv()
print("CWD:", os.getcwd())
print("Env path:", os.getenv("LLM_MODEL_PATH"))
print("Exists:", os.path.exists(os.getenv("LLM_MODEL_PATH")))