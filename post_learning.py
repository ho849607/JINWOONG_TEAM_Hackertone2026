import os
import csv
import json

def save_confirmed_features(features, corrected_label, feedback_dir="feedback"):
    """
    Saves extracted features and the user-confirmed label to a CSV file.
    This is a privacy-aware post-learning approach. The system does not 
    immediately learn from raw voice. It stores processed features only 
    after user confirmation.
    """
    os.makedirs(feedback_dir, exist_ok=True)
    feedback_file = os.path.join(feedback_dir, "confirmed_features.csv")
    
    file_exists = os.path.exists(feedback_file)
    
    with open(feedback_file, 'a', newline='') as csvfile:
        writer = csv.writer(csvfile)
        
        # If new file, you could write a header, but for variable length features
        # it's easier to just save label as first column and features as rest
        # or serialize features as JSON string.
        
        feature_str = json.dumps(features)
        writer.writerow([corrected_label, feature_str])
        
    return True
