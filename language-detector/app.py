import streamlit as st
import os
import pandas as pd
from predict import AccentPredictor
from train_model import train_classifier
from analyze_dataset import scan_dataset
from post_learning import save_confirmed_features

st.set_page_config(page_title="AccentLens", page_icon="🎤", layout="wide")

st.title("AccentLens: English Accent Pattern Analyzer")
st.markdown("⚠️ **Disclaimer**: This system does not predict nationality. It estimates which English accent pattern the pronunciation is closest to. Results are probabilistic and may be wrong. The system should be used for education or pronunciation feedback, not discrimination.")

tab1, tab2, tab3, tab4, tab5 = st.tabs(["Dataset Analysis", "Train Model", "Predict Accent", "Post-Learning Feedback", "About"])

with tab1:
    st.header("Dataset Analysis")
    st.write("Inspect the current dataset structure and statistics.")
    if st.button("Run Dataset Analysis"):
        with st.spinner("Analyzing dataset..."):
            report = scan_dataset()
            if report:
                st.text_area("Analysis Report", report, height=400)
                st.success("Report saved to reports/dataset_report.txt")

with tab2:
    st.header("Train Classifier")
    st.write("Train the model using the audio files in the `dataset/` directory.")
    
    dataset_dir = "dataset"
    if st.button("Train Model"):
        with st.spinner("Extracting features and training model... This may take a while."):
            success, accuracy = train_classifier()
            if success:
                st.success(f"Model trained successfully! Test set accuracy: {accuracy*100:.2f}%")
                st.info("Check the `reports/` folder for confusion matrix and detailed evaluation metrics.")
            else:
                st.error("Training failed. Make sure you have audio files in your dataset folders.")

with tab3:
    st.header("Predict Accent Pattern")
    st.write("Upload an English audio recording to analyze its accent pattern.")
    
    uploaded_file = st.file_uploader("Choose an audio file", type=['wav', 'mp3', 'm4a'])
    
    if uploaded_file is not None:
        st.audio(uploaded_file)
        
        if st.button("Analyze Pronunciation"):
            with st.spinner("Analyzing audio features..."):
                try:
                    predictor = AccentPredictor()
                    results = predictor.predict(uploaded_file)
                    
                    st.session_state['last_prediction'] = results
                    st.session_state['top_prediction'] = results['top_prediction']
                    st.session_state['last_features'] = results['features']
                    
                    st.success("Analysis complete!")
                    st.subheader(f"Your pronunciation is closest to {results['top_prediction']}.")
                    
                    # Create dataframe for charting
                    probs = results['probabilities']
                    df = pd.DataFrame(list(probs.items()), columns=["Accent Group", "Probability"])
                    df["Probability (%)"] = (df["Probability"] * 100).round(1)
                    
                    st.write("### Probability Scores:")
                    for idx, row in df.iterrows():
                        st.write(f"- {row['Accent Group']}: {row['Probability (%)']}%")
                        st.progress(float(row['Probability']))
                        
                except ValueError as e:
                    st.error(str(e))
                except Exception as e:
                    st.error(f"An unexpected error occurred: {str(e)}")

with tab4:
    st.header("Post-Learning Feedback")
    st.write("Help improve the model. If you just ran a prediction, you can confirm or correct the result here.")
    
    if 'last_prediction' in st.session_state:
        st.write(f"**Last Prediction:** {st.session_state.get('top_prediction', 'N/A')}")
        
        predictor = AccentPredictor()
        classes = predictor.metadata['labels'] if predictor.metadata else []
        
        corrected_label = st.selectbox("Confirm or correct the accent pattern:", classes, index=classes.index(st.session_state.get('top_prediction')) if st.session_state.get('top_prediction') in classes else 0)
        
        consent = st.checkbox("I consent to storing the extracted acoustic features (not the raw audio) and this label to improve the system.")
        
        if st.button("Submit Feedback"):
            if consent:
                if 'last_features' in st.session_state:
                    save_confirmed_features(st.session_state['last_features'], corrected_label)
                    st.success("Feedback saved! The system only stored the processed features, maintaining your privacy.")
                else:
                    st.error("No features found. Please run a prediction first.")
            else:
                st.warning("Please check the consent box to submit feedback.")
    else:
        st.info("Please run a prediction in the 'Predict Accent' tab first.")

with tab5:
    st.header("About the Method")
    st.markdown("""
    ### How it works
    - **Speech-to-text** asks "what did the user say?"
    - **This system** asks "how did the user pronounce it?"
    
    Instead of transcribing words, this system analyzes acoustic features such as rhythm, pitch, stress, and MFCC (Mel-frequency cepstral coefficients) of the voice. By extracting these features, a machine learning model learns the acoustic signature of different English accent patterns.
    
    ### Safety and Ethics
    - Accent does not perfectly represent nationality or identity.
    - Results are probabilistic and may be wrong.
    - The system should be used for education or pronunciation feedback, not discrimination.
    - Do not use it for hiring, immigration, policing, or sensitive decisions.
    """)
