import librosa
import numpy as np

def extract_mfcc_features(audio, sr=16000, n_mfcc=20):
    """
    Extract MFCC features, compute mean, standard deviation,
    delta, and delta-delta across time.
    Returns a fixed-length feature vector.
    """
    if len(audio) == 0:
        return np.zeros(n_mfcc * 6) # mean, std for mfcc, delta, delta-delta
        
    # Extract MFCCs
    mfccs = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=n_mfcc)
    
    # Compute Delta and Delta-Delta
    delta_mfccs = librosa.feature.delta(mfccs)
    delta2_mfccs = librosa.feature.delta(mfccs, order=2)
    
    # Compute mean and std for all
    mfccs_mean = np.mean(mfccs, axis=1)
    mfccs_std = np.std(mfccs, axis=1)
    
    delta_mean = np.mean(delta_mfccs, axis=1)
    delta_std = np.std(delta_mfccs, axis=1)
    
    delta2_mean = np.mean(delta2_mfccs, axis=1)
    delta2_std = np.std(delta2_mfccs, axis=1)
    
    # Concatenate into a single feature vector
    feature_vector = np.concatenate((
        mfccs_mean, mfccs_std,
        delta_mean, delta_std,
        delta2_mean, delta2_std
    ))
    
    return feature_vector

def extract_wav2vec_features(audio, sr=16000):
    """
    Placeholder for Wav2Vec2 or HuBERT embeddings.
    For a production system, this would load a pretrained Hugging Face model,
    pass the audio through it, and pool the embeddings.
    """
    # NOTE: Implementation requires transformers and torch
    # from transformers import Wav2Vec2Processor, Wav2Vec2Model
    # import torch
    
    raise NotImplementedError("Wav2Vec2 feature extraction is not implemented in this MVP. Use MFCCs instead.")
