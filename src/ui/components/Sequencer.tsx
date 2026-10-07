import { Pause, Play, RefreshCw, Square } from 'lucide-react';
import { useState } from 'react';
import type { SessionState, SloopDeviceSession, StepData } from '../../core/SloopDeviceSession';

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
        <span className="ml-2 text-xs text-zinc-500">{isDrums ? `16 lanes × ${count} steps` : `${count} steps · note, velocity, accent, slide, ratchet`}</span>
      </div>
      <div className="flex gap-2">
        {virtual ? <button onClick={onTogglePlay} className={`rounded px-3 py-1.5 text-xs font-black ${playing ? 'bg-amber-300 text-black' : 'bg-emerald-300 text-black'}`}>{playing ? <><Pause size={12} className="mr-1 inline" />PAUSE</> : <><Play size={12} className="mr-1 inline" />PLAY</>}</button> : <div className="rounded border border-white/8 px-2.5 py-1.5 text-[10px] text-zinc-500"><Square size={11} className="mr-1 inline"/>transport on FM-1</div>}
        <button onClick={() => void session.refreshSequence()} className="rounded border border-white/10 px-2.5 py-1.5 text-xs"><RefreshCw size={12} className="mr-1 inline" />refresh</button>
      </div>
    </div>

    {isDrums
      ? <DrumGrid state={state} session={session} playhead={playhead} count={count} />
      : <SynthGrid state={state} session={session} count={count} playhead={playhead} onAudition={onAudition} />}
  </section>;
}

function SynthGrid({ state, session, count, playhead, onAudition }: { state: SessionState; session: SloopDeviceSession; count: number; playhead: number; onAudition: (note: number) => void }) {
  const [insertNote, setInsertNote] = useState(60);
  const [selected, setSelected] = useState<number | null>(null);
  const selectedStep = selected === null ? undefined : state.steps.find((step) => step.index === selected);

  async function toggle(index: number) {
    const current = state.steps.find((step) => step.index === index);
    if (current?.notes.length) await session.setStep({ ...current, notes: [], time: 2 });
    else await session.toggleStep(index, insertNote);
    setSelected(index);
  }

  async function patchStep(patch: Partial<StepData>) {
    if (selected === null) return;
    const current = state.steps.find((step) => step.index === selected) ?? { index: selected, notes: [insertNote], time: 0 as const, flags: 0, velocity: 100, level: 100, ratchet: 0 };
    const next = { ...current, ...patch };
    await session.setStep(next);
  }

  return <div>
    <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-white/7 bg-black/20 p-3">
      <label className="text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500">Insert note
        <select value={insertNote} onChange={(event) => setInsertNote(Number(event.target.value))} className="mt-1 block rounded border border-white/10 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200">
          {Array.from({ length: 48 }, (_, index) => 36 + index).map((note) => <option key={note} value={note}>{noteName(note)} · {note}</option>)}
        </select>
      </label>
      <button onClick={() => onAudition(insertNote)} className="rounded border border-white/10 px-3 py-1.5 text-xs">Audition</button>
      <div className="ml-auto text-[10px] text-zinc-600">Click step: toggle · click active step again: rest · select a step to edit details</div>
    </div>

    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: Math.ceil(count / 16) }, (_, bank) => <div key={bank} className="rounded-lg border border-white/7 bg-black/20 p-2">
        <div className="mb-2 text-[10px] font-bold text-zinc-600">{bank * 16 + 1}–{Math.min(count, bank * 16 + 16)}</div>
        <div className="grid grid-cols-4 gap-1">
          {Array.from({ length: 16 }, (_, local) => {
            const index = bank * 16 + local;
            if (index >= count) return null;
            const step = state.steps.find((item) => item.index === index);
            const active = !!step?.notes.length;
            const current = playhead === index;
            const selectedNow = selected === index;
            return <button key={index} onContextMenu={(event) => { event.preventDefault(); setSelected(index); if (step?.notes[0]) onAudition(step.notes[0]); }} onClick={() => void toggle(index)} className={`relative h-12 rounded border font-mono text-[10px] transition ${current ? 'ring-2 ring-white/80' : selectedNow ? 'ring-2 ring-cyan-300/70' : ''} ${active ? 'border-emerald-300/60 bg-emerald-300/20 text-emerald-100' : 'border-white/7 bg-black/20 text-zinc-600 hover:bg-white/5'}`}>
              <span>{active ? noteName(step!.notes[0]) : index + 1}</span>
              {active && <span className="absolute bottom-1 right-1 text-[8px] text-emerald-300/60">{step?.ratchet ? `R${step.ratchet + 1}` : ''}{step && (step.flags & 1) ? ' A' : ''}</span>}
            </button>;
          })}
        </div>
      </div>)}
    </div>

    {selected !== null && <div className="mt-3 grid gap-3 rounded-lg border border-cyan-300/15 bg-cyan-300/[.03] p-3 sm:grid-cols-2 lg:grid-cols-6">
      <div><div className="text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500">Step</div><div className="mt-1 font-mono text-sm">{selected + 1}</div></div>
      <label className="text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500">Note<select disabled={!selectedStep?.notes.length} value={selectedStep?.notes[0] ?? insertNote} onChange={(event) => void patchStep({ notes: [Number(event.target.value)], time: 0 })} className="mt-1 w-full rounded border border-white/10 bg-zinc-950 px-2 py-1.5 text-xs">{Array.from({ length: 48 }, (_, index) => 36 + index).map((note) => <option key={note} value={note}>{noteName(note)}</option>)}</select></label>
      <label className="text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500">Velocity {selectedStep?.velocity ?? 100}<input disabled={!selectedStep?.notes.length} type="range" min={1} max={127} value={selectedStep?.velocity ?? 100} onChange={(event) => void patchStep({ velocity: Number(event.target.value) })} className="mt-2 w-full accent-emerald-300" /></label>
      <label className="text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500">Level {selectedStep?.level ?? 100}<input disabled={!selectedStep?.notes.length} type="range" min={0} max={255} value={selectedStep?.level ?? 100} onChange={(event) => void patchStep({ level: Number(event.target.value) })} className="mt-2 w-full accent-emerald-300" /></label>
      <label className="text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500">Ratchet<select disabled={!selectedStep?.notes.length} value={selectedStep?.ratchet ?? 0} onChange={(event) => void patchStep({ ratchet: Number(event.target.value) })} className="mt-1 w-full rounded border border-white/10 bg-zinc-950 px-2 py-1.5 text-xs"><option value={0}>Off</option><option value={1}>2×</option><option value={2}>3×</option><option value={3}>4×</option></select></label>
      <div className="flex items-end gap-1"><button disabled={!selectedStep?.notes.length} onClick={() => void patchStep({ flags: (selectedStep?.flags ?? 0) ^ 1 })} className={`rounded border px-2 py-1.5 text-xs ${(selectedStep?.flags ?? 0) & 1 ? 'border-amber-300/50 bg-amber-300/15 text-amber-100' : 'border-white/10 text-zinc-500'}`}>ACCENT</button><button disabled={!selectedStep?.notes.length} onClick={() => void patchStep({ flags: (selectedStep?.flags ?? 0) ^ 2 })} className={`rounded border px-2 py-1.5 text-xs ${(selectedStep?.flags ?? 0) & 2 ? 'border-cyan-300/50 bg-cyan-300/15 text-cyan-100' : 'border-white/10 text-zinc-500'}`}>SLIDE</button></div>
    </div>}
  </div>;
}

function DrumGrid({ state, session, playhead, count }: { state: SessionState; session: SloopDeviceSession; playhead: number; count: number }) {
  const [bank, setBank] = useState(0);
  const banks = Math.max(1, Math.ceil(count / 16));
  const safeBank = Math.min(bank, banks - 1);
  const firstStep = safeBank * 16;
  const visibleSteps = Math.min(16, count - firstStep);

  return <div>
    <div className="mb-3 flex flex-wrap gap-1">{Array.from({ length: banks }, (_, index) => <button key={index} onClick={() => setBank(index)} className={`rounded border px-3 py-1.5 text-xs ${safeBank === index ? 'border-rose-300/50 bg-rose-300/15 text-rose-100' : 'border-white/10 text-zinc-500'}`}>{index * 16 + 1}–{Math.min(count, index * 16 + 16)}</button>)}</div>
    <div className="overflow-auto">
      <div className="min-w-[1050px] space-y-1">
        {Array.from({ length: 16 }, (_, lane) => <div key={lane} className="grid grid-cols-[72px_repeat(16,1fr)] gap-1">
          <span className="py-2 text-[10px] font-bold text-zinc-500">LANE {lane + 1}</span>
          {Array.from({ length: visibleSteps }, (_, localIndex) => {
            const stepIndex = firstStep + localIndex;
            const step = state.drumSteps.find((item) => item.index === stepIndex);
            const on = step?.on[lane] ?? false;
            return <button key={stepIndex} onClick={() => void session.setDrumLane(stepIndex, lane, !on)} className={`h-8 rounded border text-[9px] ${playhead === stepIndex ? 'ring-2 ring-white/80' : ''} ${on ? 'border-rose-300/60 bg-rose-300/25 text-rose-100' : 'border-white/7 bg-black/20 text-zinc-700 hover:bg-white/5'}`}>{stepIndex + 1}</button>;
          })}
        </div>)}
      </div>
    </div>
  </div>;
}

function noteName(note: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return `${names[note % 12]}${Math.floor(note / 12) - 1}`;
}
