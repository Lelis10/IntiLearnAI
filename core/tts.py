import os
import torch
import soundfile as sf
from dotenv import load_dotenv
# Asume Kokoro cargado; ajusta import según repo (ej. from kokoro.inference import KokoroTTS)

load_dotenv()

class TTS:
    def __init__(self):
        self.model_path = os.getenv("KOKORO_MODEL_PATH")
        # Carga modelo (ejemplo; adapta del repo hexgrad/kokoro)
        self.model = torch.hub.load(self.model_path, 'kokoro_tts', source='local')  # Ajusta
        self.voice = os.getenv("KOKORO_VOICE", "es_speaker_0")

    def synthesize(self, text, output_path="output.wav"):
        audio = self.model.inference(text, speaker=self.voice)  # Ajusta método
        sf.write(output_path, audio, samplerate=22050)
        return output_path

if __name__ == "__main__":
    tts = TTS()
    output = tts.synthesize("Prueba de voz: Hola, soy tu tutor educativo.")
    print(f"Audio generado en {output}")