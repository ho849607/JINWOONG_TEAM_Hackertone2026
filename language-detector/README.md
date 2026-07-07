# AccentLens: English Accent Pattern Analyzer

## Project Overview
Our project is an English accent pattern classification system. Most speech systems focus on what the user said (Speech-to-Text). Our system focuses on *how* the user pronounced it. 

We extract acoustic features from English speech and classify which accent group the pronunciation is closest to. We do not claim to predict nationality directly. Instead, we provide probability scores for accent patterns such as Korean-accented English, Japanese-accented English, Indian-accented English, American English, and British English.

## Difference from Normal Speech Recognition
- **Normal ASR**: Focuses on semantics (transcribing "what was said").
- **AccentLens**: Focuses on acoustics (analyzing rhythm, pitch, MFCCs to determine "how it was pronounced").

## Dataset Folder Structure
To train the model, organize your audio files in the `dataset/` directory, where each subfolder name is the label:

```
dataset/
  Korean-accented English/
    audio1.wav
    audio2.wav
  American English/
    audio1.wav
    audio2.wav
```

## How to Install Dependencies
```bash
pip install -r requirements.txt
```

## How to Run Dataset Analysis
1. Start the Streamlit app.
2. Go to the "Dataset Analysis" tab.
3. Click "Run Dataset Analysis" to see file counts, audio durations, and class imbalance warnings.
4. The report is also saved to `reports/dataset_report.txt`.

## How to Train the Model
You can train the model directly through the Streamlit UI (in the "Train Model" tab), or run the script manually:
```bash
python train_model.py
```
This will save the model, label encoder, and metadata to the `models/` directory, and evaluation metrics/confusion matrix to the `reports/` directory.

## How to Run Streamlit
```bash
streamlit run app.py
```

## How to Test Prediction
1. Start the Streamlit app.
2. Go to the "Predict Accent" tab.
3. Upload a `.wav`, `.mp3`, or `.m4a` file containing English speech.
4. Click "Analyze Pronunciation" to see the probability scores.

## How Post-Learning Works
After a prediction is made, users can go to the "Post-Learning Feedback" tab to confirm or correct the predicted accent. If the user consents, the system saves the extracted acoustic feature vectors (not the raw audio) and the corrected label to `feedback/confirmed_features.csv`. This is a privacy-aware approach that allows for future model retraining without keeping sensitive voice data.

## Limitations
- Performance depends heavily on the quality and size of the training dataset.
- Short audio clips or noisy backgrounds can reduce accuracy.
- It only categorizes accents based on the classes it was trained on.

## Ethics Disclaimer
- Accent does not perfectly represent nationality.
- Results are probabilistic and may be wrong.
- The system should be used for education or pronunciation feedback, not discrimination.
- Do not use it for hiring, immigration, policing, or sensitive decisions.
