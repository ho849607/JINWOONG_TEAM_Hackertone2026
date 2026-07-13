# Optional second-stage accent classifier contract

The accent classifier is intentionally separate from synthetic-voice detection. It runs only when the first-stage detector returns a fake probability of `0.35` or lower (`likely_human`). This sequential flow prevents an accent result from lending false credibility to likely synthetic audio.

Set `ACCENT_CLASSIFIER_URL` to an HTTPS `POST` endpoint. If `ACCENT_CLASSIFIER_TOKEN` is set, the app sends it as a bearer token.

## Request

```json
{ "audioBase64": "...", "mimeType": "audio/webm" }
```

## Response

```json
{
  "model": "accent-model@revision",
  "probabilities": [
    { "label": "US English", "probability": 0.66 },
    { "label": "UK English", "probability": 0.19 },
    { "label": "Indian English", "probability": 0.10 },
    { "label": "Australian English", "probability": 0.05 }
  ]
}
```

The probabilities must be finite values from 0 to 1. Before production use, evaluate the model across languages, mixed accents, short clips, code-switching, noise, codecs, and demographic groups. Describe results as linguistic accent estimates, never nationality or identity.
