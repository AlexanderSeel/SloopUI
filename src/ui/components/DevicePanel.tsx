import type { SessionState, SloopDeviceSession } from '../../core/SloopDeviceSession';
import { ParameterControl } from './ParameterControl';

const TRACK_NAMES = ['SYNTH 1', 'SYNTH 2', 'SYNTH 3', 'DRUMS'];

export function DevicePanel({ state, session }: { state: SessionState; session: SloopDeviceSession }) {
  const parameters = state.descriptors.filter((descriptor) => descriptor.scope === 0);
  const globals = state.descriptors.filter((descriptor) => descriptor.scope === 1);
  const engine = state.tracks[state.selectedTrack]?.engine ?? 0;
  const title = state.selectedTrack === 3 ? 'DRUMS' : state.info?.engineNames[engine] ?? 'Device';

  return <section className="hardware-panel rounded-xl p-4">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-3">
      <div>
        <div className="text-[10px] font-black tracking-[.28em] text-emerald-300">SLOOP // FM-1</div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="text-[10px] text-zinc-600">descriptor-driven controls · live firmware sync</div>
      </div>
      <div className="flex flex-wrap gap-2">
        {state.tracks.map((track, index) => <button key={track.index} onClick={() => void session.selectTrack(index)} className={`rounded border px-3 py-1.5 text-xs font-bold ${index === state.selectedTrack ? 'border-emerald-300/60 bg-emerald-300/15 text-emerald-100' : 'border-white/10 text-zinc-400 hover:bg-white/5'}`}>
          {TRACK_NAMES[index] ?? `TRK ${index + 1}`}{track.mute ? ' · M' : ''}
        </button>)}
      </div>
    </div>

    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
      {parameters.map((descriptor) => <ParameterControl key={`p${descriptor.id}`} descriptor={descriptor} value={state.values[`0:${descriptor.id}`] ?? descriptor.defaultValue} onChange={(value) => void session.setParameter(0, descriptor.id, value)} />)}
    </div>

    {globals.length > 0 && <details className="mt-4">
      <summary className="cursor-pointer select-none text-xs font-bold uppercase tracking-[.15em] text-zinc-500">Global controls</summary>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
        {globals.map((descriptor) => <ParameterControl key={`g${descriptor.id}`} descriptor={descriptor} value={state.values[`1:${descriptor.id}`] ?? descriptor.defaultValue} onChange={(value) => void session.setParameter(1, descriptor.id, value)} />)}
      </div>
    </details>}
  </section>;
}
