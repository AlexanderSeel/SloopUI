import { useEffect, useMemo, useState } from 'react';
import { Cable, CirclePower, Cpu, Disc3, Layers3, Radio, SlidersHorizontal, Waves } from 'lucide-react';
import { SloopDeviceSession, type SessionState } from '../core/SloopDeviceSession';
import { WebMidiSloopTransport } from '../core/WebMidiSloopTransport';
import { VirtualSloopTransport } from '../core/VirtualSloopTransport';
import type { MidiPortDescriptor, MidiPortSelection } from '../core/portTypes';
import { ConnectionSetup } from './components/ConnectionSetup';
import { DevicePanel } from './components/DevicePanel';
import { SampleEditor } from './components/SampleEditor';
import { Sequencer } from './components/Sequencer';

const EMPTY_STATE: SessionState = { loading: false, connected: false, selectedTrack: 0, tracks: [], descriptors: [], values: {}, steps: [], drumSteps: [], sampleSlots: [] };
const DRUM_NOTES = [36, 38, 42, 46, 41, 43, 45, 49, 51, 39, 37, 54, 56, 75, 81, 82];

export function App() {
  const [mode, setMode] = useState<'hardware' | 'virtual'>('virtual');
  const [state, setState] = useState<SessionState>(EMPTY_STATE);
  const [status, setStatus] = useState('Offline workspace ready');
  const [ports, setPorts] = useState<MidiPortDescriptor[]>([]);
  const [selection, setSelection] = useState<MidiPortSelection>({});
  const [scanning, setScanning] = useState(false);
  const [connectionError, setConnectionError] = useState<string>();
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(-1);

  const transport = useMemo(() => mode === 'hardware' ? new WebMidiSloopTransport(selection) : new VirtualSloopTransport(), [mode, selection.inputId, selection.outputId]);
  const session = useMemo(() => new SloopDeviceSession(transport), [transport]);

  useEffect(() => {
    const unsubscribe = session.subscribe(setState);
    setState(session.snapshot());
    return () => { unsubscribe(); };
  }, [session]);

  useEffect(() => () => { void session.disconnect(); }, [session]);

  const bpmDescriptor = state.descriptors.find((descriptor) => descriptor.scope === 1 && descriptor.label.toUpperCase() === 'BPM');
  const bpm = bpmDescriptor ? state.values[`1:${bpmDescriptor.id}`] ?? bpmDescriptor.defaultValue : 120;

  useEffect(() => {
    if (!playing || mode !== 'virtual' || !state.connected || !(transport instanceof VirtualSloopTransport)) {
      setPlayhead(-1);
      return;
    }
    const stepCount = Math.max(1, state.info?.stepCount ?? 64);
    const milliseconds = 60000 / Math.max(20, bpm) / 4;
    let current = -1;
    const tick = () => {
      current = (current + 1) % stepCount;
      setPlayhead(current);
      if (state.selectedTrack === 3) {
        const drum = state.drumSteps.find((step) => step.index === current);
        drum?.on.forEach((enabled, lane) => { if (enabled) transport.audition(midiToTone(DRUM_NOTES[lane] ?? 36), '32n'); });
      } else {
        const step = state.steps.find((item) => item.index === current);
        step?.notes.forEach((note) => transport.audition(midiToTone(note), '16n'));
      }
    };
    tick();
    const timer = window.setInterval(tick, milliseconds);
    return () => window.clearInterval(timer);
  }, [playing, mode, state.connected, state.info?.stepCount, state.selectedTrack, state.steps, state.drumSteps, bpm, transport]);

  async function connect() {
    setConnectionError(undefined);
    try {
      setStatus(mode === 'hardware' ? 'Requesting Web MIDI + SysEx…' : 'Starting virtual audio engine…');
      await session.connect();
      setStatus(mode === 'hardware' ? 'SLOOP connected · WATCH live sync active' : 'Virtual SLOOP online');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      setStatus(message);
      setConnectionError(message);
    }
  }

  async function disconnect() {
    setPlaying(false);
    await session.disconnect();
    setStatus('Disconnected');
  }

  async function switchMode() {
    setPlaying(false);
    await session.disconnect().catch(() => undefined);
    setState(EMPTY_STATE);
    setConnectionError(undefined);
    setMode((current) => current === 'hardware' ? 'virtual' : 'hardware');
    setStatus('Mode changed · connect when ready');
  }

  async function scanMidi() {
    setScanning(true);
    setConnectionError(undefined);
    try {
      const found = await WebMidiSloopTransport.listPorts();
      setPorts(found);
      const preferredInput = found.find((port) => port.type === 'input' && /m-vave|fm-1|sloop/i.test(`${port.manufacturer} ${port.name}`));
      const preferredOutput = found.find((port) => port.type === 'output' && /m-vave|fm-1|sloop/i.test(`${port.manufacturer} ${port.name}`));
      setSelection((current) => ({ inputId: current.inputId ?? preferredInput?.id, outputId: current.outputId ?? preferredOutput?.id }));
      setStatus(`${found.length} MIDI ports found`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to scan MIDI ports';
      setConnectionError(message);
      setStatus(message);
    } finally {
      setScanning(false);
    }
  }

  function audition(note: number) {
    if (transport instanceof VirtualSloopTransport) transport.audition(midiToTone(note), '8n');
  }

  return <main className="min-h-screen">
    <header className="sticky top-0 z-20 border-b border-white/8 bg-[#0c0f11]/90 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1900px] items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-md border border-emerald-300/30 bg-emerald-300/10"><Waves className="text-emerald-300" size={19} /></div>
          <div><b>SloopUI</b><div className="text-[10px] uppercase tracking-[.2em] text-zinc-500">FM-1 hardware studio</div></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden text-right md:block">
            <div className={`text-xs ${state.connected ? 'text-emerald-300' : state.error || connectionError ? 'text-rose-300' : 'text-zinc-400'}`}>{state.loading ? 'Loading device…' : state.error ?? connectionError ?? status}</div>
            <div className="text-[10px] text-zinc-600">{state.info ? `${state.info.firmware} · protocol v${state.info.protocolVersion}` : mode === 'hardware' ? 'Direct Web MIDI / SysEx' : 'Tone.js virtual device'}</div>
          </div>
          <button onClick={() => void switchMode()} className="rounded border border-white/10 px-3 py-2 text-xs"><Cpu size={14} className="mr-1 inline" />{mode.toUpperCase()}</button>
          <button disabled={state.loading} onClick={() => void (state.connected ? disconnect() : connect())} className={`rounded px-3 py-2 text-xs font-black ${state.connected ? 'bg-emerald-300 text-black' : 'bg-white text-black'} disabled:opacity-40`}><CirclePower size={14} className="mr-1 inline" />{state.connected ? 'DISCONNECT' : 'CONNECT'}</button>
        </div>
      </div>
    </header>

    <div className="mx-auto grid max-w-[1900px] gap-4 p-4 xl:grid-cols-[190px_minmax(0,1fr)]">
      <aside className="hardware-panel hidden h-fit rounded-xl p-3 xl:block">
        <div className="mb-2 px-2 text-[10px] font-bold tracking-[.2em] text-zinc-600">STUDIO</div>
        <NavItem icon={<SlidersHorizontal size={15} />} label="Device" href="#device" />
        <NavItem icon={<Layers3 size={15} />} label="Sequence" href="#sequence" />
        <NavItem icon={<Disc3 size={15} />} label="Samples" href="#samples" />
        <NavItem icon={<Radio size={15} />} label="Effects" href="#device" />
        <NavItem icon={<Cable size={15} />} label="Routing" href="#device" />
      </aside>

      <div className="space-y-4">
        {state.connected ? <>
          <div id="device"><DevicePanel state={state} session={session} /></div>
          <div id="sequence"><Sequencer state={state} session={session} virtual={mode === 'virtual'} playing={playing} playhead={playhead} onTogglePlay={() => setPlaying((value) => !value)} onAudition={audition} /></div>
          <div id="samples"><SampleEditor state={state} /></div>
        </> : <ConnectionSetup mode={mode} ports={ports} selection={selection} scanning={scanning} error={connectionError} onScan={() => void scanMidi()} onSelectionChange={setSelection} onConnect={() => void connect()} />}
      </div>
    </div>
  </main>;
}

function NavItem({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return <a href={href} className="mb-1 flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-zinc-300 hover:bg-white/5">{icon}{label}</a>;
}

function midiToTone(note: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return `${names[note % 12]}${Math.floor(note / 12) - 1}`;
}
