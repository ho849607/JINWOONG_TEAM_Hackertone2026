import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Clock3,
  Download,
  FileAudio,
  Languages,
  Mic,
  RefreshCw,
  ShieldCheck,
  Square,
  Upload,
  WifiOff,
} from 'lucide-react';
import Visualizer from './components/Visualizer';

type AnalysisStatus =
  | 'idle'
  | 'requesting-permission'
  | 'recording'
  | 'processing'
  | 'success'
  | 'error';

interface AnalysisResult {
  transcription: string;
  language: string;
  deepfake: {
    status: 'available' | 'unavailable' | 'error';
    label?: 'likely_human' | 'likely_synthetic' | 'uncertain';
    fakeProbability?: number;
    model?: string;
    note?: string;
  };
  accent: {
    status: 'available' | 'skipped' | 'unavailable' | 'error';
    label?: string;
    confidence?: number;
    probabilities?: Array<{ label: string; probability: number }>;
    model?: string;
    note?: string;
  };
}

interface ApiError {
  error?: string;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const MAX_RECORD_SECONDS = 30;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const API_TIMEOUT_MS = 60_000;

const MIME_TYPE_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/mp4',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/webm',
  'audio/ogg;codecs=opus',
];

function getSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  return MIME_TYPE_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('오디오 파일을 읽지 못했습니다.'));
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const separator = dataUrl.indexOf(',');
      if (separator < 0) {
        reject(new Error('오디오 파일 형식이 올바르지 않습니다.'));
        return;
      }
      resolve(dataUrl.slice(separator + 1));
    };
    reader.readAsDataURL(blob);
  });
}

function statusMessage(status: number, fallback?: string) {
  if (status === 400) return fallback || '오디오 요청이 올바르지 않습니다.';
  if (status === 413) return '오디오가 너무 큽니다. 더 짧게 녹음해 주세요.';
  if (status === 429) return '분석 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  if (status === 502 || status === 503) return '음성 분석 서비스가 잠시 불안정합니다. 잠시 후 다시 시도해 주세요.';
  return '분석 중 문제가 발생했습니다. 다시 시도해 주세요.';
}

export default function App() {
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(MAX_RECORD_SECONDS);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosInstallHelp, setShowIosInstallHelp] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const countdownRef = useRef<number | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isRecording = status === 'recording';
  const isBusy = status === 'requesting-permission' || status === 'processing';

  const clearCountdown = () => {
    if (countdownRef.current !== null) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  };

  const resetRecorder = () => {
    clearCountdown();
    releaseStream();
    recorderRef.current = null;
    chunksRef.current = [];
    setRemainingSeconds(MAX_RECORD_SECONDS);
  };

  const analyzeAudio = async (audio: Blob) => {
    if (!navigator.onLine) {
      setError('인터넷 연결이 필요합니다. 연결 상태를 확인해 주세요.');
      setStatus('error');
      return;
    }

    if (!audio.size) {
      setError('녹음된 소리가 없습니다. 다시 녹음해 주세요.');
      setStatus('error');
      return;
    }

    if (audio.size > MAX_FILE_BYTES) {
      setError('오디오 파일은 8MB 이하여야 합니다.');
      setStatus('error');
      return;
    }

    setStatus('processing');
    setError(null);
    setResult(null);

    const abortController = new AbortController();
    requestAbortRef.current = abortController;
    const timeout = window.setTimeout(() => abortController.abort(), API_TIMEOUT_MS);

    try {
      const audioBase64 = await blobToBase64(audio);
      const response = await fetch('/api/analyze-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          mimeType: audio.type || 'audio/webm',
        }),
        signal: abortController.signal,
      });

      let payload: AnalysisResult | ApiError | null = null;
      try {
        payload = (await response.json()) as AnalysisResult | ApiError;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const apiMessage = payload && 'error' in payload ? payload.error : undefined;
        throw new Error(statusMessage(response.status, apiMessage));
      }

      if (
        !payload ||
        !('transcription' in payload) ||
        !('language' in payload) ||
        typeof payload.transcription !== 'string' ||
        typeof payload.language !== 'string' ||
        typeof payload.deepfake !== 'object' ||
        typeof payload.accent !== 'object'
      ) {
        throw new Error('분석 결과 형식이 올바르지 않습니다.');
      }

      setResult({
        transcription: payload.transcription.trim(),
        language: payload.language.trim() || '알 수 없음',
        deepfake: payload.deepfake,
        accent: payload.accent,
      });
      setStatus('success');
    } catch (caught) {
      const message =
        caught instanceof DOMException && caught.name === 'AbortError'
          ? '분석 시간이 초과되었습니다. 다시 시도해 주세요.'
          : caught instanceof Error
            ? caught.message
            : '분석 중 문제가 발생했습니다.';
      setError(message);
      setStatus('error');
    } finally {
      window.clearTimeout(timeout);
      if (requestAbortRef.current === abortController) requestAbortRef.current = null;
    }
  };

  const finishRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      setStatus('processing');
      recorder.stop();
    }
  };

  const startRecording = async () => {
    if (isBusy || isRecording) return;

    setError(null);
    setResult(null);

    if (!window.isSecureContext && location.hostname !== 'localhost') {
      setError('마이크는 HTTPS 주소에서만 사용할 수 있습니다.');
      setStatus('error');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('이 브라우저는 직접 녹음을 지원하지 않습니다. 오디오 파일 업로드를 이용해 주세요.');
      setStatus('error');
      return;
    }

    setStatus('requesting-permission');

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const mimeType = getSupportedMimeType();
      let recorder: MediaRecorder;
      try {
        recorder = mimeType ? new MediaRecorder(mediaStream, { mimeType }) : new MediaRecorder(mediaStream);
      } catch {
        recorder = new MediaRecorder(mediaStream);
      }

      chunksRef.current = [];
      streamRef.current = mediaStream;
      recorderRef.current = recorder;
      setStream(mediaStream);
      setRemainingSeconds(MAX_RECORD_SECONDS);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        resetRecorder();
        setError('녹음 중 오류가 발생했습니다. 다시 시도해 주세요.');
        setStatus('error');
      };

      recorder.onstop = () => {
        clearCountdown();
        const outputType = recorder.mimeType || mimeType || chunksRef.current[0]?.type || 'audio/webm';
        const audio = new Blob(chunksRef.current, { type: outputType });
        releaseStream();
        recorderRef.current = null;
        chunksRef.current = [];
        setRemainingSeconds(MAX_RECORD_SECONDS);
        void analyzeAudio(audio);
      };

      mediaStream.getAudioTracks().forEach((track) => {
        track.addEventListener('ended', finishRecording, { once: true });
      });

      recorder.start(1_000);
      setStatus('recording');

      const startedAt = Date.now();
      countdownRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1_000);
        const nextRemaining = Math.max(0, MAX_RECORD_SECONDS - elapsed);
        setRemainingSeconds(nextRemaining);
        if (nextRemaining === 0) finishRecording();
      }, 250);
    } catch (caught) {
      resetRecorder();
      const permissionDenied =
        caught instanceof DOMException && (caught.name === 'NotAllowedError' || caught.name === 'SecurityError');
      setError(
        permissionDenied
          ? '마이크 권한이 거절되었습니다. 브라우저의 사이트 설정에서 마이크 권한을 허용해 주세요.'
          : '마이크를 시작하지 못했습니다. 다른 브라우저나 파일 업로드를 이용해 주세요.',
      );
      setStatus('error');
    }
  };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      setError('오디오 파일만 업로드할 수 있습니다.');
      setStatus('error');
      return;
    }
    void analyzeAudio(file);
  };

  const resetAnalysis = () => {
    requestAbortRef.current?.abort();
    setResult(null);
    setError(null);
    setStatus('idle');
  };

  const installApp = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      return;
    }
    setShowIosInstallHelp((current) => !current);
  };

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    window.addEventListener('beforeinstallprompt', beforeInstall);

    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      requestAbortRef.current?.abort();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      resetRecorder();
    };
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && recorderRef.current?.state === 'recording') finishRecording();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

  return (
    <main className="min-h-[100dvh] bg-slate-950 px-[max(1rem,env(safe-area-inset-left))] pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] text-white">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6 flex items-start justify-between gap-3 py-3 sm:mb-10">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20">
              <Languages aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">VoxShield · Voice Lens</p>
              <h1 className="text-xl font-bold sm:text-2xl">음성 진위·언어 분석</h1>
            </div>
          </div>

          {!isStandalone && (
            <button
              type="button"
              onClick={() => void installApp()}
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-slate-700 px-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-400 hover:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              aria-label="홈 화면에 앱 설치"
            >
              <Download className="h-5 w-5" aria-hidden="true" />
              <span className="hidden sm:inline">설치</span>
            </button>
          )}
        </header>

        {showIosInstallHelp && isIos && !isStandalone && (
          <div className="mb-4 rounded-2xl border border-cyan-800 bg-cyan-950/50 p-4 text-sm text-cyan-100" role="status">
            Safari 아래쪽의 <strong>공유</strong> 버튼을 누른 뒤 <strong>홈 화면에 추가</strong>를 선택하세요.
          </div>
        )}

        {!isOnline && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-700 bg-amber-950/60 p-4 text-amber-100" role="alert">
            <WifiOff className="h-5 w-5 shrink-0" aria-hidden="true" />
            음성 분석에는 인터넷 연결이 필요합니다.
          </div>
        )}

        <section className="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900 shadow-2xl shadow-black/30">
          <div className="border-b border-slate-800 bg-gradient-to-br from-cyan-500/15 via-slate-900 to-violet-500/10 p-5 sm:p-8">
            <div className="mb-6 flex items-start gap-3 text-slate-300">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
              <p className="text-sm leading-6">
                녹음은 분석할 때만 전송되며 서버에 저장하지 않습니다. AI 음성 판별 모델이 연결된 경우 확률 기반 참고 결과도 함께 표시합니다.
              </p>
            </div>

            <Visualizer stream={stream} isActive={isRecording} />

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={() => void startRecording()}
                  disabled={isBusy || !isOnline}
                  className="inline-flex min-h-14 flex-1 items-center justify-center gap-3 rounded-2xl bg-cyan-400 px-5 font-bold text-slate-950 transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isBusy ? <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Mic className="h-5 w-5" aria-hidden="true" />}
                  {status === 'requesting-permission' ? '권한 확인 중' : status === 'processing' ? '분석 중' : '녹음 시작'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={finishRecording}
                  className="inline-flex min-h-14 flex-1 items-center justify-center gap-3 rounded-2xl bg-rose-500 px-5 font-bold text-white transition hover:bg-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:ring-offset-2 focus:ring-offset-slate-900"
                >
                  <Square className="h-5 w-5 fill-current" aria-hidden="true" />
                  녹음 중지
                </button>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy || isRecording || !isOnline}
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-slate-700 px-5 font-bold text-slate-100 transition hover:border-cyan-400 hover:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-44"
              >
                <Upload className="h-5 w-5" aria-hidden="true" />
                파일 선택
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFile}
                className="sr-only"
                aria-label="오디오 파일 업로드"
              />
            </div>

            {isRecording && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-rose-200" role="status" aria-live="polite">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-400" />
                녹음 중 · {remainingSeconds}초 남음
              </div>
            )}
          </div>

          <div className="p-5 sm:p-8" aria-live="polite">
            {status === 'idle' && (
              <div className="py-8 text-center text-slate-400">
                <FileAudio className="mx-auto mb-3 h-10 w-10 text-slate-600" aria-hidden="true" />
                <p className="font-semibold text-slate-300">한국어 또는 다른 언어로 말해보세요.</p>
                <p className="mt-2 text-sm">최대 30초 · 최대 8MB</p>
              </div>
            )}

            {status === 'processing' && (
              <div className="flex flex-col items-center py-10 text-center">
                <RefreshCw className="mb-4 h-9 w-9 animate-spin text-cyan-300" aria-hidden="true" />
                <p className="font-bold">음성을 분석하고 있어요.</p>
                <p className="mt-2 text-sm text-slate-400">창을 닫지 말고 잠시 기다려 주세요.</p>
              </div>
            )}

            {status === 'error' && error && (
              <div className="rounded-2xl border border-rose-800 bg-rose-950/40 p-5" role="alert">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" aria-hidden="true" />
                  <div>
                    <p className="font-bold text-rose-100">분석하지 못했습니다.</p>
                    <p className="mt-2 text-sm leading-6 text-rose-200">{error}</p>
                  </div>
                </div>
                <button type="button" onClick={resetAnalysis} className="mt-4 min-h-11 rounded-xl bg-rose-500 px-4 font-semibold text-white">
                  다시 시도
                </button>
              </div>
            )}

            {status === 'success' && result && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  <p className="font-bold">분석 완료</p>
                </div>
                <div className="rounded-2xl border border-violet-900/70 bg-violet-950/20 p-5">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-violet-300">Step 1 · 진위 스크리닝</p>
                  <div className="mb-3 flex items-center gap-2 text-sm text-slate-400">
                    <Bot className="h-4 w-4" aria-hidden="true" /> AI 음성 가능성
                  </div>
                  {result.deepfake.status === 'available' && typeof result.deepfake.fakeProbability === 'number' ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-lg font-bold text-violet-200">
                          {result.deepfake.label === 'likely_synthetic'
                            ? '합성 음성 가능성 높음'
                            : result.deepfake.label === 'likely_human'
                              ? '사람 음성 가능성 높음'
                              : '판정 불확실'}
                        </p>
                        <p className="text-sm font-semibold text-slate-300">
                          합성 확률 {Math.round(result.deepfake.fakeProbability * 100)}%
                        </p>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500"
                          style={{ width: `${Math.round(result.deepfake.fakeProbability * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs leading-5 text-slate-500">
                        {result.deepfake.note} 모델: {result.deepfake.model || '알 수 없음'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm leading-6 text-slate-400">
                      {result.deepfake.note || 'AI 음성 판별 모델 서버가 아직 연결되지 않았습니다.'}
                    </p>
                  )}
                </div>

                <div className="mt-4 rounded-2xl border border-cyan-900/70 bg-cyan-950/20 p-5">
                  <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Step 2 · 언어 프로파일링</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                    <div className="mb-2 flex items-center gap-2 text-sm text-slate-400">
                      <Languages className="h-4 w-4" aria-hidden="true" /> 감지 언어
                    </div>
                    <p className="text-xl font-bold text-cyan-300">{result.language}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                    <div className="mb-2 flex items-center gap-2 text-sm text-slate-400">
                      <FileAudio className="h-4 w-4" aria-hidden="true" /> 받아쓰기
                    </div>
                    <p className="whitespace-pre-wrap leading-7 text-slate-100">
                      {result.transcription || '말소리를 인식하지 못했습니다.'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:col-span-2">
                    <div className="mb-3 flex items-center justify-between gap-3 text-sm text-slate-400">
                      <span>영어 억양 추정</span>
                      {result.accent.status === 'available' && typeof result.accent.confidence === 'number' && (
                        <span className="font-semibold text-cyan-300">{Math.round(result.accent.confidence * 100)}%</span>
                      )}
                    </div>
                    {result.accent.status === 'available' && result.accent.probabilities?.length ? (
                      <div className="space-y-3">
                        <p className="text-lg font-bold text-cyan-200">{result.accent.label}</p>
                        {result.accent.probabilities.map((item) => (
                          <div key={item.label} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-xs">
                            <span className="truncate text-slate-300">{item.label}</span>
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                              <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.round(item.probability * 100)}%` }} />
                            </div>
                            <span className="text-right text-slate-400">{Math.round(item.probability * 100)}%</span>
                          </div>
                        ))}
                        <p className="text-xs leading-5 text-slate-500">{result.accent.note}</p>
                      </div>
                    ) : (
                      <p className="text-sm leading-6 text-slate-400">{result.accent.note || '억양 분류 모델이 연결되지 않았습니다.'}</p>
                    )}
                  </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetAnalysis}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 px-4 font-semibold text-slate-200 hover:border-cyan-400 hover:text-cyan-300"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" /> 다시 분석
                </button>
              </div>
            )}
          </div>
        </section>

        <footer className="mt-5 flex items-start gap-2 px-2 text-xs leading-5 text-slate-500">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          분석 결과는 참고용입니다. AI 생성 음성 결과는 확률 추정이며 개인 식별·범죄 판단 등의 단독 증거로 사용할 수 없습니다.
        </footer>
      </div>
    </main>
  );
}
