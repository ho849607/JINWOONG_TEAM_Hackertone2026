# Render deployment checklist

1. Root directory: `language-detector`
2. Runtime: Node
3. Build command: `npm ci && npm run build`
4. Start command: `npm start`
5. Health check: `/health`
6. Required secret: `GEMINI_API_KEY`
7. Optional inference services:
   - `VOICE_DETECTOR_URL` and `VOICE_DETECTOR_TOKEN`
   - `ACCENT_CLASSIFIER_URL` and `ACCENT_CLASSIFIER_TOKEN`

After deployment, open `/health`. The app is ready when `status` is `ok`.
Deepfake and accent status remain `unavailable` until their optional services are configured.
