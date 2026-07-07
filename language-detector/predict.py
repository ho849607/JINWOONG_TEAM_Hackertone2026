import joblib
import numpy as np
import json
import os
from audio_utils import load_and_preprocess_audio
from feature_extractor import extract_mfcc_features

class AccentPredictor:
    def __init__(self, model_dir="models"):
        self.model_path = os.path.join(model_dir, "accent_classifier.joblib")
        self.label_encoder_path = os.path.join(model_dir, "labels.joblib")
        self.metadata_path = os.path.join(model_dir, "model_metadata.json")
        self.clf = None
        self.le = None
        self.metadata = None
        self.load_model()
        
    def load_model(self):
        if os.path.exists(self.model_path) and os.path.exists(self.label_encoder_path):
            self.clf = joblib.load(self.model_path)
            self.le = joblib.load(self.label_encoder_path)
            if os.path.exists(self.metadata_path):
                with open(self.metadata_path, 'r') as f:
                    self.metadata = json.load(f)
            return True
        return False
        
    def predict(self, audio_source):
        if self.clf is None or self.le is None:
            if not self.load_model():
                raise ValueError("Model not trained or missing. Please train the model first.")
                
        # Process audio
        audio = load_and_preprocess_audio(audio_source)
        
        # Extract features
        features = extract_mfcc_features(audio)
        
        # Reshape for prediction
        X = features.reshape(1, -1)
        
        # Predict probabilities
        probas = self.clf.predict_proba(X)[0]
        
        # Get class names
        classes = self.le.classes_
        
        # Create a dictionary of {class_name: probability}
        prob_dict = {classes[i]: float(probas[i]) for i in range(len(classes))}
        
        # Sort by probability descending
        sorted_probs = dict(sorted(prob_dict.items(), key=lambda item: item[1], reverse=True))
        
        # Top prediction
        top_pred = list(sorted_probs.keys())[0]
        
        return {
            "top_prediction": top_pred,
            "probabilities": sorted_probs,
            "features": features.tolist() # Keep features for optional post-learning
        }
