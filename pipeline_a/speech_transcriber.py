from faster_whisper import WhisperModel
import numpy as np

class SpeechTranscriber:
    def __init__(self, model_size="distil-large-v3", compute_type="int8_float16"):
        self.model = WhisperModel(model_size, device="cuda", compute_type=compute_type)

    def transcribe(self, audio_chunk: np.ndarray) -> str:
        segments, _ = self.model.transcribe(audio_chunk, beam_size=5, language="en", condition_on_previous_text=False)
        text = " ".join([segment.text for segment in segments])
        return text.strip()
