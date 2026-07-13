# Optional deepfake voice detector contract

The web service works without a detector and reports language/transcription only. To enable probabilistic synthetic-voice analysis, deploy a separate inference service and set `VOICE_DETECTOR_URL`.

Recommended model candidate: `koyelog/deepfake-voice-detector-sota` (Apache-2.0). It is a custom PyTorch Wav2Vec2 + BiGRU + attention checkpoint, accepts 4-second 16 kHz mono windows, and is not currently served by a Hugging Face Inference Provider. Verify its architecture and checkpoint loading code before deployment.

## Request

`POST /predict`, HTTPS only in production.

```json
{
  "audioBase64": "...",
  "mimeType": "audio/webm"
}
```

If `VOICE_DETECTOR_TOKEN` is set, the app sends `Authorization: Bearer <token>`.

## Response

```json
{
  "fakeProbability": 0.82,
  "model": "koyelog/deepfake-voice-detector-sota@<revision>"
}
```

`fakeProbability` must be a finite number from 0 to 1. The Node API converts it into:

- `0.00–0.35`: likely human
- `0.35–0.65`: uncertain
- `0.65–1.00`: likely synthetic

## Required inference safeguards

1. Decode only allow-listed audio containers; reject malformed files.
2. Convert server-side to mono 16 kHz PCM and split into 4-second windows.
3. Cap decoded duration and memory before running inference.
4. Aggregate multiple windows (median is preferable to a single window).
5. Do not persist raw audio or log base64 payloads.
6. Pin the model revision and dependencies; verify checkpoint hashes.
7. Add authentication, rate limiting, request timeouts, and concurrency caps.
8. Return `uncertain`-compatible probabilities for low-quality or out-of-distribution audio.
9. Evaluate Korean speech, codecs, background noise, replayed audio, and unseen generators before claiming production accuracy.

This score must never be presented as proof that a person committed fraud or that a recording is authentic.
