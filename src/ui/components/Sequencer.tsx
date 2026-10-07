import { Pause, Play, RefreshCw, Square } from 'lucide-react';
import type { SessionState, SloopDeviceSession } from '../../core/SloopDeviceSession';

export function Sequencer({ state, session, virtual, playing, playhead, onTogglePlay, onAudition }: {
  state: SessionState;
  session: SloopDeviceSession;
  virtual: boolean;
  playing: boolean;
  playhead: number;
  onTogglePlay: () => void;
  onAudition: (note: number) => void;
}) {
  const count = state.info?.stepCount ?? 64;
  const isDrums = state.selectedTrack === 3;

  return <section className="hardware-panel rounded-xl p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div>
        <b>{isDrums ? 'Drum Grid' : 'Sequence'}</b>
        <span className="ml-2 text-xs text-zinc-500">{isDrums ? `16 lanes × ${count} steps` : `${count} steps · click to toggle`}</span>
      </div>
      <div className="flex gap-2">
        {virtual ? <button onClick={onTogglePlay} className={`rounded px-3 py-1.5 text-xs font-black ${playing ? 'bg-amber-300 text-black' : 'bg-emerald-300 text-black'}`}>{playing ? <><Pause size={12} className="mr-1 inline" />PAUSE</> : <><Play size={12} className="mr-1 inline" />PLAY</>}</button> : <div className="rounded border border-white/8 px-2.5 py-1.5 text-[10px] text-zinc-500"><Square size={11} className="mr-1 inline"/>transport on FM-1</div>}
        <button onClick={() => void session.refreshSequence()} className="rounded border border-white/10 px-2.5 py-1.5 text-xs"><RefreshCw size={12} className="mr-1 inline" />refresh</button>
      </div>
    </div>

    {isDrums
      ? <DrumGrid state={state} session={session} playhead={playhead} />
      : <SynthGrid state={state} session={session} count={count} playhead={playhead} onAudition={onAudition} />}
  </section>;
}

function SynthGrid({ state, session, count, playhead, onAudition }: { state: SessionState; session: SloopDeviceSession; count: number; playhead: number; onAudition: (note: number) => void }) {
  return <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
    {Array.from({ length: Math.ceil(count / 16) }, (_, bank) => <div key={bank} className="rounded-lg border border-white/7 bg-black/20 p-2">
      <div className="mb-2 text-[10px] font-bold text-zinc-600">{bank * 16 + 1}–{Math.min(count, bank * 16 + 16)}</div>
      <div className="grid grid-cols-4 gap-1">
        {Array.from({ length: 16 }, (_, local) => {
          const index = bank * 16 + local;
          if (index >= count) return null;
          const step = state.steps.find((item) => item.index === index);
          const active = !!step?.notes.length;
          const current = playhead === index;
          return <button key={index} onContextMenu={(event) => { event.preventDefault(); if (step?.notes[0]) onAudition(step.notes[0]); }} onClick={() => void session.toggleStep(index)} className={`relative h-12 rounded border font-mono text-[10px] transition ${current ? 'ring-2 ring-white/80' : ''} ${active ? 'border-emerald-300/60 bg-emerald-300/20 text-emerald-100' : 'border-white/7 bg-black/20 text-zinc-600 hover:bg-white/5'}`}>
            <span>{active ? noteName(step!.notes[0]) : index + 1}</span>
            {active && <span className="absolute bottom-1 right-1 text-[8px] text-emerald-300/60">{step?.ratchet ? `R${step.ratchet + 1}` : ''}</span>}
          </button>;
        })}
      </div>
    </div>)}
  </div>;
}

function DrumGrid({ state, session, playhead }: { state: SessionState; session: SloopDeviceSession; playhead: number }) {
  const visibleSteps = Math.min(16, state.info?.stepCount ?? 16);
  return <div className="overflow-auto">
    <div className="min-w-[1050px] space-y-1">
      {Array.from({ length: 16 }, (_, lane) => <div key={lane} className="grid grid-cols-[72px_repeat(16,1fr)] gap-1">
        <span className="py-2 text-[10px] font-bold text-zinc-500">LANE {lane + 1}</span>
        {Array.from({ length: visibleSteps }, (_, stepIndex) => {
          const step = state.drumSteps.find((item) => item.index === stepIndex);
          const on = step?.on[lane] ?? false;
          return <button key={stepIndex} onClick={() => void session.setDrumLane(stepIndex, lane, !on)} className={`h-8 rounded border text-[9px] ${playhead === stepIndex ? 'ring-2 ring-white/80' : ''} ${on ? 'border-rose-300/60 bg-rose-300/25 text-rose-100' : 'border-white/7 bg-black/20 text-zinc-700 hover:bg-white/5'}`}>{stepIndex + 1}</button>;
        })}
      </div>)}
    </div>
  </div>;
}

function noteName(note: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return `${names[note % 12]}${Math.floor(note / 12) - 1}`;
}
