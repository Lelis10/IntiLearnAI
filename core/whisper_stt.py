import os
import whisper
from dotenv import load_dotenv

load_dotenv()

class STT:
    def __init__(self):
        model_size = os.getenv("WHISPER_MODEL_SIZE", "base")
        self.model = whisper.load_model(model_size)

    def transcribe(self, audio_path):
        result = self.model.transcribe(audio_path, language="es")
        return result["text"]

if __name__ == "__main__":
    stt = STT()
    # Reemplaza con un audio real para prueba
    text = stt.transcribe("path/to/test_audio.wav")
    print("Transcripción:", text)