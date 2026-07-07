import React, { useState, useRef, useEffect } from 'react';
import { History, Mic, Volume2, Square, Loader2 } from 'lucide-react';
import Visualizer from './components/Visualizer';

type Log = {
  id: string;
  text: string;
  language: string;
  time: string;
  isProcessing?: boolean;
};

const getSupportedMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/aac',
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) {
      return t;
    }
  }
  return '';
};

export default function App() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(mediaStream);
      
      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(mediaStream, options);
      mediaRecorder.current = recorder;
      audioChunks.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: recorder.mimeType });
        await processAudio(audioBlob, recorder.mimeType);
        
        mediaStream.getTracks().forEach(track => track.stop());
        setStream(null);
      };

      recorder.start();
      setIsRecording(true);
      
      // Add a processing log
      setLogs(prev => [...prev, {
        id: `SGNL_${String(prev.length + 1).padStart(3, '0')}`,
        text: '',
        language: '',
        time: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
        isProcessing: true
      }]);

    } catch (err) {
      console.error("Failed to start recording:", err);
      alert("마이크 권한을 허용해주세요.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (blob: Blob, mimeType: string) => {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const base64Audio = base64data.split(',')[1];

        const response = await fetch('/api/analyze-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioBase64: base64Audio, mimeType })
        });

        if (!response.ok) {
          throw new Error('Failed to analyze');
        }

        const data = await response.json();
        
        setLogs(prev => {
          const newLogs = [...prev];
          const lastLog = newLogs[newLogs.length - 1];
          if (lastLog && lastLog.isProcessing) {
            lastLog.isProcessing = false;
            lastLog.text = data.transcription || '음성을 인식하지 못했습니다.';
            lastLog.language = data.language || '알 수 없음';
          }
          return newLogs;
        });
      };
    } catch (err) {
      console.error(err);
      setLogs(prev => {
        const newLogs = [...prev];
        const lastLog = newLogs[newLogs.length - 1];
        if (lastLog && lastLog.isProcessing) {
          lastLog.isProcessing = false;
          lastLog.text = '오류가 발생했습니다.';
          lastLog.language = '오류';
        }
        return newLogs;
      });
    }
  };

  const currentLog = logs.length > 0 ? logs[logs.length - 1] : null;

  return (
    <div className="min-h-[100dvh] bg-white text-slate-800 font-sans w-full max-w-2xl mx-auto p-4 sm:p-6 flex flex-col relative pb-24">
      <header className="mb-6 sm:mb-10 pt-2 sm:pt-4 flex justify-between items-center">
        <div className="flex items-center gap-2 sm:gap-3 text-cyan-600">
          <History className="w-5 h-5 sm:w-6 sm:h-6" />
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-800 line-clamp-1">실시간 대화 분석</h1>
        </div>
      </header>

      <div className="flex-1 space-y-8 sm:space-y-12">
        {/* Text Analysis Section */}
        <div className="min-h-[150px] sm:min-h-[200px]">
          {currentLog ? (
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-slate-400 font-mono text-xs sm:text-sm sm:pt-2 shrink-0 hidden sm:block">
                {currentLog.id}
              </div>
              <div className="space-y-3 sm:space-y-4 w-full">
                {currentLog.isProcessing && isRecording ? (
                  <div className="text-2xl sm:text-4xl font-light text-slate-300">
                    "{/* 텍스트가 여기에 표시됩니다 */}"
                  </div>
                ) : (
                  <div className="text-2xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-snug break-keep">
                    "{currentLog.text}"
                  </div>
                )}
                
                <div className="text-cyan-500 font-mono text-xs sm:text-sm">
                  {currentLog.time}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-slate-100">
                  {isRecording ? (
                    <div className="flex items-center gap-3">
                      <span className="text-cyan-500 font-semibold tracking-widest text-xs sm:text-sm">수신 중</span>
                      <span className="text-slate-400 font-medium text-base sm:text-xl">말씀하시는 중...</span>
                    </div>
                  ) : currentLog.isProcessing ? (
                     <div className="flex items-center gap-3">
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-500 animate-spin" />
                      <span className="text-slate-500 font-medium text-base sm:text-lg">음성 분석 중...</span>
                     </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-cyan-600 font-semibold tracking-widest text-xs sm:text-sm shrink-0">감지된 언어</span>
                      <span className="text-slate-700 font-bold text-lg sm:text-xl">{currentLog.language}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
             <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 sm:space-y-4 pt-4 sm:pt-10">
               <Mic className="w-10 h-10 sm:w-12 sm:h-12 opacity-20" />
               <p className="text-sm sm:text-base text-center break-keep">아래 버튼을 눌러 시작하세요</p>
             </div>
          )}
        </div>

        {/* Audio Visualizer Section */}
        <div>
          <div className="flex items-center gap-2 sm:gap-3 text-slate-800 mb-3 sm:mb-4">
            <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600" />
            <h2 className="text-base sm:text-lg font-bold tracking-tight">음성 데이터 분석</h2>
          </div>
          <Visualizer stream={stream} isActive={isRecording} />
        </div>
      </div>

      {/* Controls */}
      <div className="fixed bottom-6 sm:bottom-10 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[200px] sm:max-w-none flex justify-center z-50">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`flex items-center justify-center gap-2 sm:gap-3 px-6 sm:px-8 py-3 sm:py-4 rounded-full font-bold text-white shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 text-sm sm:text-base w-full sm:w-auto ${
            isRecording 
              ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-200' 
              : 'bg-cyan-500 hover:bg-cyan-600 shadow-cyan-200'
          }`}
        >
          {isRecording ? (
            <>
              <Square className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              <span>분석 중지</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>입력 시작</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
