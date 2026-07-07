import librosa
import numpy as np
import warnings

def load_and_preprocess_audio(file_path_or_bytes, sr=16000, min_duration_sec=1.0):
    """
    Load audio, convert to mono, resample to 16kHz, and trim silence.
    Rejects files that are too short.
    """
    try:
        # Ignore warnings about PySoundFile falling back to audioread for mp3/m4a
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            # Load audio (works with file paths and file-like objects)
            audio, _ = librosa.load(file_path_or_bytes, sr=sr, mono=True)
            
        # Check duration
        duration = librosa.get_duration(y=audio, sr=sr)
        if duration < min_duration_sec:
            raise ValueError(f"Audio is too short ({duration:.2f}s). Minimum required is {min_duration_sec}s.")

        # Trim silence
        audio_trimmed, _ = librosa.effects.trim(audio)
        
        # Normalize volume
        if np.max(np.abs(audio_trimmed)) > 0:
            audio_normalized = audio_trimmed / np.max(np.abs(audio_trimmed))
        else:
            audio_normalized = audio_trimmed
            
        return audio_normalized
    except Exception as e:
        raise ValueError(f"Error processing audio (might be unsupported format): {str(e)}")
