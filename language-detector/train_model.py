import os
import json
import numpy as np
import datetime
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns
import joblib
from audio_utils import load_and_preprocess_audio
from feature_extractor import extract_mfcc_features

def train_classifier(dataset_dir="dataset", model_dir="models", reports_dir="reports"):
    features = []
    labels = []
    
    print(f"Scanning dataset directory: {dataset_dir}")
    if not os.path.exists(dataset_dir):
        print(f"Dataset directory '{dataset_dir}' not found. Please create it and add audio files.")
        return False, 0
        
    classes = [d for d in os.listdir(dataset_dir) if os.path.isdir(os.path.join(dataset_dir, d))]
    
    if not classes:
        print("No class folders found in dataset directory.")
        return False, 0
        
    for class_name in classes:
        class_dir = os.path.join(dataset_dir, class_name)
        files = [f for f in os.listdir(class_dir) if f.endswith(('.wav', '.mp3', '.m4a'))]
        
        for file_name in files:
            file_path = os.path.join(class_dir, file_name)
            try:
                audio = load_and_preprocess_audio(file_path, min_duration_sec=0.5)
                feature = extract_mfcc_features(audio)
                features.append(feature)
                labels.append(class_name)
            except Exception as e:
                print(f"Skipping {file_name}: {e}")
                
    if not features:
        print("No valid audio files found to train on.")
        return False, 0
        
    X = np.array(features)
    y = np.array(labels)
    
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)
    
    print("\nNOTE: Splitting at the file level. Speaker-level split is recommended if speaker IDs are available.")
    
    if len(X) > 5:
        X_train, X_test, y_train, y_test = train_test_split(X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded)
    else:
        print("Not enough data for train/test split. Training on all data.")
        X_train, X_test, y_train, y_test = X, X, y_encoded, y_encoded
        
    print("Training Random Forest Classifier...")
    clf = RandomForestClassifier(n_estimators=100, random_state=42)
    clf.fit(X_train, y_train)
    
    # Evaluation
    y_pred = clf.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    
    os.makedirs(reports_dir, exist_ok=True)
    
    # Classification report
    report_text = classification_report(y_test, y_pred, target_names=le.classes_)
    eval_path = os.path.join(reports_dir, "evaluation_report.txt")
    with open(eval_path, "w") as f:
        f.write(f"Model Evaluation Report\n")
        f.write(f"=======================\n")
        f.write(f"Accuracy: {accuracy:.4f}\n\n")
        f.write(report_text)
        
    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred)
    plt.figure(figsize=(10, 8))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=le.classes_, yticklabels=le.classes_)
    plt.xlabel('Predicted Label')
    plt.ylabel('True Label')
    plt.title('Confusion Matrix')
    plt.tight_layout()
    plt.savefig(os.path.join(reports_dir, "confusion_matrix.png"))
    plt.close()
    
    # Save models and metadata
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, "accent_classifier.joblib")
    label_encoder_path = os.path.join(model_dir, "labels.joblib")
    metadata_path = os.path.join(model_dir, "model_metadata.json")
    
    joblib.dump(clf, model_path)
    joblib.dump(le, label_encoder_path)
    
    # Calculate class counts
    class_counts = {c: int(np.sum(y == c)) for c in le.classes_}
    
    metadata = {
        "feature_type": "MFCC + Delta + Delta-Delta (Mean & Std)",
        "sample_rate": 16000,
        "mfcc_count": 20,
        "labels": list(le.classes_),
        "training_date": datetime.datetime.now().isoformat(),
        "number_of_samples_per_label": class_counts,
        "test_accuracy": accuracy,
        "feature_vector_size": int(X.shape[1])
    }
    
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=4)
        
    print(f"Model, labels, and metadata saved to {model_dir}")
    print(f"Reports saved to {reports_dir}")
    
    return True, accuracy

if __name__ == "__main__":
    train_classifier()
