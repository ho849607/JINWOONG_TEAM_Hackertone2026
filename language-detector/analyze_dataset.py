import os
import librosa
import numpy as np

def scan_dataset(dataset_dir="dataset", report_path="reports/dataset_report.txt"):
    """
    Scans the dataset folder, collects statistics, and saves a report.
    """
    if not os.path.exists(dataset_dir):
        print(f"Dataset directory '{dataset_dir}' not found.")
        return False
        
    classes = [d for d in os.listdir(dataset_dir) if os.path.isdir(os.path.join(dataset_dir, d))]
    
    if not classes:
        print("No class folders found in dataset directory.")
        return False

    stats = {
        'total_files': 0,
        'class_counts': {},
        'durations': [],
        'sample_rates': set(),
        'errors': 0
    }
    
    for class_name in classes:
        class_dir = os.path.join(dataset_dir, class_name)
        files = [f for f in os.listdir(class_dir) if f.endswith(('.wav', '.mp3', '.m4a'))]
        stats['class_counts'][class_name] = len(files)
        
        for file_name in files:
            file_path = os.path.join(class_dir, file_name)
            try:
                # Load without resampling to get true sample rate
                audio, sr = librosa.load(file_path, sr=None, mono=True)
                duration = librosa.get_duration(y=audio, sr=sr)
                stats['durations'].append(duration)
                stats['sample_rates'].add(sr)
                stats['total_files'] += 1
            except Exception as e:
                stats['errors'] += 1
                
    # Generate report
    report_lines = []
    report_lines.append("Dataset Inspection Report")
    report_lines.append("=========================")
    report_lines.append(f"Total valid audio files: {stats['total_files']}")
    report_lines.append(f"Corrupted/unreadable files: {stats['errors']}")
    report_lines.append("\nFiles per accent label:")
    
    class_counts = list(stats['class_counts'].values())
    if class_counts:
        max_count = max(class_counts)
        min_count = min(class_counts)
        
        for class_name, count in stats['class_counts'].items():
            report_lines.append(f"  - {class_name}: {count} files")
            
        if max_count > min_count * 2 and min_count > 0:
            report_lines.append("\nWARNING: Class imbalance detected. The model may become biased toward labels with more samples.")
            
    if stats['durations']:
        report_lines.append(f"\nAverage audio duration: {np.mean(stats['durations']):.2f} seconds")
        report_lines.append(f"Minimum duration: {np.min(stats['durations']):.2f} seconds")
        report_lines.append(f"Maximum duration: {np.max(stats['durations']):.2f} seconds")
        
    report_lines.append(f"\nUnique sample rates detected: {list(stats['sample_rates'])}")
    
    report_text = "\n".join(report_lines)
    print(report_text)
    
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, "w") as f:
        f.write(report_text)
        
    return report_text

if __name__ == "__main__":
    scan_dataset()
