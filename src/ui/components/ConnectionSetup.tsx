import { Cable, RefreshCw, Waves } from 'lucide-react';
import type { MidiPortDescriptor, MidiPortSelection } from '../../core/portTypes';

export function ConnectionSetup({ mode, ports, selection, scanning, error, onScan, onSelectionChange, onConnect }: {
  mode: 'hardware' | 'virtual';
  ports: MidiPortDescriptor[];
  selection: MidiPortSelection;
  scanning: boolean;
  error?: string;
  onScan: () => void;
  onSelectionChange: (selection: MidiPortSelection) => void;
  onConnect: () => void;
}) {
  const inputs = ports.filter((port) => port.type === 'input');
  const outputs = ports.filter((port) => port.type === 'output');

  return <section className="hardware-panel grid min-h-[520px] place-items-center rounded-xl p-8">
    <div className="w-full max-w-2xl">
      <div className="text-center">
        <Waves size={50} className="mx-auto mb-5 text-emerald-300" />
        <h1 className="text-3xl font-black">SLOOP Studio</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-400">{mode === 'hardware' ? 'Connect the M-VAVE FM-1 directly through Web MIDI with SysEx permission. SloopUI keeps WATCH alive and mirrors firmware changes live.' : 'Virtual mode uses the same session and protocol model, backed by Tone.js, so you can sketch sounds and patterns without the FM-1.'}</p>
      </div>

      {mode === 'hardware' && <div className="mt-7 rounded-xl border border-white/8 bg-black/20 p-4">
        <div className="mb-3 flex items-center justify-between"><div><b className="text-sm">Direct MIDI connection</b><div className="text-[10px] text-zinc-500">Chrome/Edge · HTTPS or localhost · SysEx permission required</div></div><button onClick={onScan} disabled={scanning} className="rounded border border-white/10 px-2.5 py-1.5 text-xs disabled:opacity-40"><RefreshCw size={12} className={`mr-1 inline ${scanning ? 'animate-spin' : ''}`} />SCAN</button></div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500">MIDI Input<select value={selection.inputId ?? ''} onChange={(event) => onSelectionChange({ ...selection, inputId: event.target.value || undefined })} className="mt-1 w-full rounded border border-white/10 bg-zinc-950 px-2 py-2 text-xs text-zinc-200"><option value="">Auto detect FM-1</option>{inputs.map((port) => <option key={port.id} value={port.id}>{port.manufacturer ? `${port.manufacturer} · ` : ''}{port.name}</option>)}</select></label>
          <label className="text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500">MIDI Output<select value={selection.outputId ?? ''} onChange={(event) => onSelectionChange({ ...selection, outputId: event.target.value || undefined })} className="mt-1 w-full rounded border border-white/10 bg-zinc-950 px-2 py-2 text-xs text-zinc-200"><option value="">Auto detect FM-1</option>{outputs.map((port) => <option key={port.id} value={port.id}>{port.manufacturer ? `${port.manufacturer} · ` : ''}{port.name}</option>)}</select></label>
        </div>
        {error && <div className="mt-3 rounded border border-rose-300/20 bg-rose-300/5 px-3 py-2 text-xs text-rose-200">{error}</div>}
      </div>}

      <div className="mt-6 text-center"><button onClick={onConnect} className="rounded bg-emerald-300 px-5 py-2.5 text-sm font-black text-black"><Cable size={14} className="mr-2 inline" />{mode === 'hardware' ? 'CONNECT FM-1' : 'START VIRTUAL SLOOP'}</button></div>
    </div>
  </section>;
}
