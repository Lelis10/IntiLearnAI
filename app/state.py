import threading
from typing import Optional
from core.rag_engine import RAGEngine

class GlobalState:
    def __init__(self):
        self.rag_engine: Optional[RAGEngine] = None
        self.status = "starting"  # starting, loading_model, ready, error
        self.error_message: Optional[str] = None
        self._lock = threading.Lock()

    def initialize_rag(self):
        with self._lock:
            self.status = "loading_model"
        
        try:
            print("Starting background RAG initialization...")
            # Initialize the engine (this is the heavy operation)
            engine = RAGEngine()
            
            with self._lock:
                self.rag_engine = engine
                self.status = "ready"
            print("Background RAG initialization complete.")
            
        except Exception as e:
            print(f"Background RAG initialization failed: {e}")
            with self._lock:
                self.status = "error"
                self.error_message = str(e)

# Global instance
app_state = GlobalState()
