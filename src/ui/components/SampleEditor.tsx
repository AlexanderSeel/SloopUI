import { Download, Play, Square, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { SessionState } from '../../core/SloopDeviceSession';

export function SampleEditor({ state }: { state: SessionState }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<AudioBufferSourceNode>();
  const contextRef = useRef<AudioContext>();
  const [buffer, setBuffer] = useState<AudioBuffer>();
  const [name, setName] = useState('No local sample loaded');
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(1);
  const [playing, setPlaying] = useState(false);

  useEffect(() => { drawWaveform(canvas.current, buffer, selectionStart, selectionEnd); }, [buffer, selectionStart, selectionEnd]);
  useEffect(() => () => { sourceRef.current?.stop(); void contextRef.current?.close(); }, []);

  async function load(file: File) {
    const context = new AudioContext();
    const decoded = await context.decodeAudioData(await file.arrayBuffer());
    setBuffer(decoded);
    setName(file.name);
    setSelectionStart(0);
    setSelectionEnd(1);
    await context.close();
  }

  function transform(kind: 'normalize' | 'reverse' | 'fade-in' | 'fade-out' | 'trim') {
    if (!buffer) return;
    const start = Math.floor(buffer.length * selectionStart);
    const end = Math.max(start + 1, Math.floor(buffer.length * selectionEnd));
    const outputLength = kind === 'trim' ? end - start : buffer.length;
    const context = new AudioContext();
    const output = context.createBuffer(buffer.numberOfChannels, outputLength, buffer.sampleRate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const source = buffer.getChannelData(channel);
      const target = output.getChannelData(channel);
      if (kind === 'trim') target.set(source.slice(start, end)); else target.set(source);
      if (kind === 'reverse') target.reverse();
      if (kind === 'normalize') {
        let peak = 0;
        for (const value of target) peak = Math.max(peak, Math.abs(value));
        if (peak > 0) for (let i = 0; i < target.length; i++) target[i] /= peak;
      }
      if (kind === 'fade-in' || kind === 'fade-out') {
        const fadeSamples = Math.max(1, Math.min(target.length, Math.floor(buffer.sampleRate * 0.05)));
        for (let i = 0; i < fadeSamples; i++) {
          const gain = kind === 'fade-in' ? i / fadeSamples : (fadeSamples - i) / fadeSamples;
          const index = kind === 'fade-in' ? i : target.length - fadeSamples + i;
          target[index] *= gain;
        }
      }
    }
    setBuffer(output);
    if (kind === 'trim') { setSelectionStart(0); setSelectionEnd(1); }
    void context.close();
  }

  async function togglePreview() {
    if (!buffer) return;
    if (playing) {
      sourceRef.current?.stop();
      setPlaying(false);
      return;
    }
    const context = contextRef.current && contextRef.current.state !== 'closed' ? contextRef.current : new AudioContext();
    contextRef.current = context;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => setPlaying(false);
    const startSeconds = buffer.duration * selectionStart;
    const duration = Math.max(0.001, buffer.duration * (selectionEnd - selectionStart));
    source.start(0, startSeconds, duration);
    sourceRef.current = source;
    setPlaying(true);
  }

  function exportWav() {
    if (!buffer) return;
    const wav = audioBufferToWav(buffer);
    const href = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `${name.replace(/\.[^.]+$/, '') || 'sample'}-edited.wav`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  return <section className="hardware-panel rounded-xl p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div>
        <b>Sample Lab</b>
        <div className="text-xs text-zinc-500">{name}{buffer ? ` · ${buffer.sampleRate} Hz · ${buffer.numberOfChannels}ch · ${buffer.duration.toFixed(2)} s` : ''}</div>
      </div>
      <div className="flex flex-wrap gap-1 text-xs">
        <label className="cursor-pointer rounded border border-white/10 bg-white/4 px-2.5 py-1.5 hover:bg-white/8"><Upload size={13} className="mr-1 inline" />LOAD<input className="hidden" type="file" accept="audio/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void load(file); }} /></label>
        <button disabled={!buffer} onClick={() => void togglePreview()} className="rounded border border-white/10 px-2.5 py-1.5 disabled:opacity-30">{playing ? <Square size={12} className="mr-1 inline" /> : <Play size={12} className="mr-1 inline" />}{playing ? 'Stop' : 'Preview'}</button>
        <button disabled={!buffer} onClick={() => transform('trim')} className="rounded border border-white/10 px-2.5 py-1.5 disabled:opacity-30">Trim</button>
        <button disabled={!buffer} onClick={() => transform('fade-in')} className="rounded border border-white/10 px-2.5 py-1.5 disabled:opacity-30">Fade In</button>
        <button disabled={!buffer} onClick={() => transform('fade-out')} className="rounded border border-white/10 px-2.5 py-1.5 disabled:opacity-30">Fade Out</button>
        <button disabled={!buffer} onClick={() => transform('normalize')} className="rounded border border-white/10 px-2.5 py-1.5 disabled:opacity-30">Normalize</button>
        <button disabled={!buffer} onClick={() => transform('reverse')} className="rounded border border-white/10 px-2.5 py-1.5 disabled:opacity-30">Reverse</button>
        <button disabled={!buffer} onClick={exportWav} className="rounded bg-amber-300 px-2.5 py-1.5 font-bold text-black disabled:opacity-30"><Download size={13} className="mr-1 inline" />WAV</button>
      </div>
    </div>

    <canvas ref={canvas} className="h-44 w-full rounded border border-white/8 bg-black/35" />
    <div className="mt-2 grid gap-2 md:grid-cols-2">
      <label className="text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500">Start {Math.round(selectionStart * 100)}%<input disabled={!buffer} className="mt-1 w-full accent-cyan-300" type="range" min={0} max={0.99} step={0.001} value={selectionStart} onChange={(event) => setSelectionStart(Math.min(Number(event.target.value), selectionEnd - 0.001))} /></label>
      <label className="text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500">End {Math.round(selectionEnd * 100)}%<input disabled={!buffer} className="mt-1 w-full accent-cyan-300" type="range" min={0.01} max={1} step={0.001} value={selectionEnd} onChange={(event) => setSelectionEnd(Math.max(Number(event.target.value), selectionStart + 0.001))} /></label>
    </div>

    <div className="mt-3 grid gap-2 sm:grid-cols-3">
      {state.sampleSlots.map((slot) => <div key={slot.index} className="rounded border border-white/8 bg-black/20 p-2 text-xs"><b>USR{slot.index + 1}</b><span className="ml-2 text-zinc-500">{slot.zones ? slot.name || 'sample' : 'empty'} · {slot.dataKiB} KiB</span></div>)}
      {!state.sampleSlots.length && <div className="text-xs text-zinc-600">Sample slot information unavailable.</div>}
    </div>
  </section>;
}

function drawWaveform(canvas: HTMLCanvasElement | null, buffer: AudioBuffer | undefined, selectionStart: number, selectionEnd: number) {
  if (!canvas) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
  canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = 'rgba(255,255,255,.08)';
  context.beginPath(); context.moveTo(0, canvas.height / 2); context.lineTo(canvas.width, canvas.height / 2); context.stroke();
  if (!buffer) return;
  const data = buffer.getChannelData(0);
  const mid = canvas.height / 2;
  context.strokeStyle = '#fcd34d';
  context.lineWidth = ratio;
  context.beginPath();
  for (let x = 0; x < canvas.width; x++) {
    const index = Math.min(data.length - 1, Math.floor(x / canvas.width * data.length));
    const y = mid - data[index] * mid * .9;
    if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
  }
  context.stroke();
  context.fillStyle = 'rgba(34,211,238,.12)';
  context.fillRect(canvas.width * selectionStart, 0, canvas.width * (selectionEnd - selectionStart), canvas.height);
  context.strokeStyle = '#67e8f9';
  for (const position of [selectionStart, selectionEnd]) { context.beginPath(); context.moveTo(canvas.width * position, 0); context.lineTo(canvas.width * position, canvas.height); context.stroke(); }
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const channels = buffer.numberOfChannels;
  const length = buffer.length * channels * 2 + 44;
  const output = new ArrayBuffer(length);
  const view = new DataView(output);
  const writeString = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  writeString(0, 'RIFF'); view.setUint32(4, length - 8, true); writeString(8, 'WAVE'); writeString(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); writeString(36, 'data'); view.setUint32(40, length - 44, true);
  let offset = 44;
  for (let frame = 0; frame < buffer.length; frame++) for (let channel = 0; channel < channels; channel++) {
    const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[frame]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true); offset += 2;
  }
  return output;
}
