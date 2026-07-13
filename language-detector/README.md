# VoxShield · Voice Lens

모바일과 데스크톱 브라우저에서 음성을 녹음하거나 업로드하여 받아쓰기와 언어를 분석하는 React + Express 앱입니다. Android Chrome과 iPhone Safari에서 홈 화면에 추가할 수 있는 PWA로 동작합니다.

앱은 피드백에서 제안된 순차 분석 구조를 따릅니다.

1. **진위 스크리닝**: 별도 딥페이크 음성 모델이 합성 음성 가능성을 추정합니다.
2. **언어 프로파일링**: 1차 결과가 `likely_human`일 때만 별도 억양 모델을 실행합니다.
3. **참고 보고서**: 받아쓰기, 언어, 합성 확률, 억양 확률을 한 화면에 표시합니다.

Gemini는 받아쓰기와 언어 식별에 사용됩니다. 딥페이크·억양 모델 서버가 설정되지 않은 경우 앱은 해당 결과를 꾸며내지 않고 `모델 미연결` 또는 `분석 생략`으로 표시합니다.

## 현재 구현 범위

- 실제 마이크 녹음 및 오디오 파일 업로드
- iOS/Android 호환 MediaRecorder MIME 선택
- 최대 30초, 최대 8MB 제한
- Gemini 서버 측 호출을 통한 받아쓰기와 언어 식별
- 선택형 딥페이크 음성 모델 API 연결
- 사람 음성일 때만 실행되는 선택형 억양 분류 API 연결
- PWA 매니페스트, 서비스 워커, 홈 화면 설치 안내
- 모바일 safe-area, 오프라인·권한·시간초과·과다요청 오류 처리
- CSP/Helmet, API 키 비노출, MIME/Base64 검증, 요청 속도·동시성 제한
- `/health` 배포 헬스체크

## 실행

Node.js 20 이상을 권장합니다.

```bash
npm ci
cp .env.example .env
# .env에 GEMINI_API_KEY 입력
npm run dev
```

프로덕션 빌드:

```bash
npm run lint
npm run build
NODE_ENV=production npm start
```

## Render 배포

저장소 루트에 `render.yaml`이 포함되어 있습니다. Render에서 Blueprint로 저장소를 연결하거나 다음 값을 직접 입력하세요.

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check: `/health`
- Environment: `NODE_ENV=production`
- Secret: `GEMINI_API_KEY`

Render가 제공하는 `PORT`는 서버가 자동으로 사용합니다. 기존 서비스 `https://jinwoong-team-hackertone2026-g2zf.onrender.com/`에 연결된 Git 저장소라면 이 코드를 커밋·푸시한 뒤 환경변수를 설정하고 재배포하면 됩니다.

### 선택 환경변수

| 변수 | 용도 |
|---|---|
| `GEMINI_MODEL` | 기본값 `gemini-2.5-flash` |
| `VOICE_DETECTOR_URL` | 딥페이크 판별 HTTPS 엔드포인트 |
| `VOICE_DETECTOR_TOKEN` | 딥페이크 서비스 Bearer 토큰 |
| `ACCENT_CLASSIFIER_URL` | 억양 분류 HTTPS 엔드포인트 |
| `ACCENT_CLASSIFIER_TOKEN` | 억양 서비스 Bearer 토큰 |

외부 모델 계약은 [`docs/voice-detector-contract.md`](docs/voice-detector-contract.md)와 [`docs/accent-classifier-contract.md`](docs/accent-classifier-contract.md)를 참고하세요.

## Hugging Face 모델 후보

`koyelog/deepfake-voice-detector-sota`는 Apache-2.0의 PyTorch 모델 후보입니다. 모델 카드에 따르면 Wav2Vec2 + BiGRU + attention 구조, 약 98.5M 파라미터, 4초·16kHz·모노 입력을 사용합니다. 현재 Hugging Face Inference Provider에 배포되어 있지 않고 사용자 정의 체크포인트 로딩이 필요하므로 이 Node 서비스에 직접 포함하지 않았습니다.

권장 배치는 별도 Python 추론 서비스입니다. 모델 리비전과 체크포인트 해시를 고정하고, 4초 창별 결과를 집계하며, 한국어·코덱·잡음·새 합성기에서 성능을 검증한 뒤 `VOICE_DETECTOR_URL`로 연결하세요.

## 보안·개인정보 원칙

- API 키는 브라우저 번들에 넣지 않고 Render 환경변수로만 관리합니다.
- 원본 오디오는 애플리케이션 파일이나 DB에 저장하지 않습니다.
- 요청 본문과 Base64 오디오는 로그로 남기지 않습니다.
- 허용한 오디오 MIME과 8MB 이하 Base64만 처리합니다.
- 외부 모델 URL은 HTTPS 또는 개발용 localhost만 허용합니다.
- 모델 결과를 인증·사기·범죄·신원 판단의 단독 증거로 사용하지 않습니다.

프로덕션에서는 Redis 기반 분산 rate limit, 사용자 인증, 짧은 보존기간의 감사 로그, 개인정보 처리방침·동의 화면, 예산 알림을 추가하는 것이 좋습니다.

## 검증 명령

```bash
npm run lint
npm run build
npm audit --omit=dev
```

원본 프로젝트에 있던 0바이트 Python 자리표시자는 제거했습니다. 실제 추론 코드는 별도 서비스로 배포하는 구조가 안전하며, 현재 앱은 존재하지 않는 모델을 실행하는 것처럼 표시하지 않습니다.
