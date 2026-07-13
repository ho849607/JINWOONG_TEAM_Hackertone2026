import React, { useEffect, useRef } from 'react';

export default function Visualizer({ stream, isActive }: { stream: MediaStream | null; isActive: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!stream || !canvas || !isActive) return;

    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    const values = new Uint8Array(analyser.frequencyBinCount);
    const context = canvas.getContext('2d');
    let animationFrame = 0;

    analyser.fftSize = 128;
    source.connect(analyser);
    void audioContext.resume();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    };

    const draw = () => {
      if (!context) return;
      analyser.getByteTimeDomainData(values);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.lineWidth = Math.max(2, canvas.width / 500);
      context.strokeStyle = '#22d3ee';
      context.beginPath();

      const sliceWidth = canvas.width / values.length;
      values.forEach((value, index) => {
        const x = index * sliceWidth;
        const y = (value / 255) * canvas.height;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });

      context.stroke();
      animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(animationFrame);
      source.disconnect();
      if (audioContext.state !== 'closed') void audioContext.close();
    };
  }, [stream, isActive]);

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
      <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        <span>Voice signal</span>
        <span className={isActive ? 'text-cyan-300' : 'text-slate-600'}>{isActive ? 'Recording' : 'Standby'}</span>
      </div>
      <canvas ref={canvasRef} className="h-24 w-full rounded-xl bg-slate-900" aria-label="실시간 음성 파형" />
    </div>
  );
}
