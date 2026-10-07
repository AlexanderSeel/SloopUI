import { useMemo, useState } from 'react';
import { Cable, CirclePower, Cpu, Disc3, Layers3, Play, Radio, SlidersHorizontal, Square, Upload, Waves } from 'lucide-react';
import { WebMidiSloopTransport } from '../core/WebMidiSloopTransport';
import { VirtualSloopTransport } from '../core/VirtualSloopTransport';

const tracks = [
  { name: 'SYNTH 1', accent: 'bg-emerald-400' },
  { name: 'SYNTH 2', accent: 'bg-amber-300' },
  { name: 'SYNTH 3', accent: 'bg-cyan-300' },
  { name: 'DRUMS', accent: 'bg-rose-400' },
];

function Knob({ label, value }: { label: string; value: string }) {
  return <div className="flex min-w-20 flex-col items-center gap-2">
    <div className="knob relative h-16 w-16 rounded-full"><span className="absolute left-1/2 top-1 h-5 w-0.5 -translate-x-1/2 rounded bg-white/80" /></div>
    <div className="text-center"><div className="text-[10px] font-bold tracking-[.16em] text-zinc-500">{label}</div><div className="font-mono text-xs text-zinc-200">{value}</div></div>
  </div>;
}

function DevicePanel() {
  return <section className="hardware-panel rounded-xl p-4">
    <div className="mb-4 flex items-center justify-between border-b border-white/8 pb-3">
      <div><div className="text-[10px] font-black tracking-[.28em] text-emerald-300">SLOOP // FM-1</div><h2 className="text-lg font-semibold">Analog Engine</h2></div>
      <div className="rounded border border-emerald-300/30 bg-emerald-300/8 px-3 py-1 font-mono text-xs text-emerald-200">POLY / 01</div>
    </div>
    <div className="grid grid-cols-2 gap-5 md:grid-cols-4 xl:grid-cols-8">
      <Knob label="CUTOFF" value="72%" /><Knob label="RESONANCE" value="28%" /><Knob label="ATTACK" value="12 ms" /><Knob label="DECAY" value="420 ms" />
      <Knob label="SUSTAIN" value="64%" /><Knob label="RELEASE" value="310 ms" /><Knob label="DRIVE" value="18%" /><Knob label="PAN" value="C" />
    </div>
  </section>;
}

function Sequencer() {
  return <section className="hardware-panel overflow-hidden rounded-xl">
    <header className="flex items-center justify-between border-b border-white/8 px-4 py-3"><div className="flex items-center gap-2"><Layers3 size={16}/><b>Sequence</b><span className="text-xs text-zinc-500">64 steps · 1/16 · swing 58%</span></div><div className="flex gap-2"><button className="rounded bg-emerald-300 px-3 py-1 text-xs font-black text-black"><Play size={13} className="mr-1 inline"/>PLAY</button><button className="rounded border border-white/10 px-3 py-1 text-xs"><Square size={12} className="mr-1 inline"/>STOP</button></div></header>
    <div className="grid-lines overflow-x-auto p-3">
      <div className="min-w-[900px] space-y-2">{tracks.map((track, t) => <div key={track.name} className="grid grid-cols-[100px_repeat(16,minmax(34px,1fr))] gap-1"><div className="flex items-center gap-2 text-xs font-bold"><span className={`h-2 w-2 rounded-full ${track.accent}`}/>{track.name}</div>{Array.from({length:16},(_,i)=><button key={i} className={`h-10 rounded border text-[10px] font-mono ${((i+t*2)%5===0||i===t*3)?'border-emerald-300/50 bg-emerald-300/15 text-emerald-100':'border-white/7 bg-black/15 text-zinc-600'}`}>{i+1}</button>)}</div>)}</div>
    </div>
  </section>;
}

function SampleEditor() {
  return <section className="hardware-panel rounded-xl p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><b>Sample Lab</b><div className="text-xs text-zinc-500">USR1 · 44.1 kHz · mono · loop zone 01</div></div><div className="flex flex-wrap gap-1 text-xs">{['Trim','Fade','Normalize','Reverse','Quantize','Transform'].map(x=><button key={x} className="rounded border border-white/10 bg-white/4 px-2.5 py-1.5 hover:bg-white/8">{x}</button>)}<button className="rounded bg-amber-300 px-2.5 py-1.5 font-bold text-black"><Upload size={13} className="mr-1 inline"/>SEND</button></div></div>
    <div className="relative h-36 overflow-hidden rounded border border-white/8 bg-black/35">
      <div className="absolute inset-0 grid-lines opacity-70"/><div className="absolute inset-x-0 top-1/2 h-px bg-white/10"/>
      <svg viewBox="0 0 1000 130" preserveAspectRatio="none" className="absolute inset-0 h-full w-full"><path d="M0 65 C30 8 45 118 76 54 S126 12 150 77 S194 116 220 39 S270 8 300 72 S340 118 372 48 S418 18 448 82 S492 109 520 33 S566 18 602 77 S650 104 686 42 S730 18 766 76 S816 111 850 42 S910 17 1000 67" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-300"/></svg>
      <div className="absolute bottom-0 left-[18%] top-0 w-px bg-cyan-300/70"/><div className="absolute bottom-0 left-[74%] top-0 w-px bg-cyan-300/70"/>
    </div>
  </section>;
}

export function App() {
  const [mode,setMode]=useState<'hardware'|'virtual'>('virtual');
  const [connected,setConnected]=useState(false);
  const [status,setStatus]=useState('Offline workspace ready');
  const transport=useMemo(()=>mode==='hardware'?new WebMidiSloopTransport():new VirtualSloopTransport(),[mode]);
  async function connect(){try{setStatus(mode==='hardware'?'Requesting WebMIDI + SysEx permission…':'Starting Tone.js audio engine…');await transport.connect();setConnected(true);setStatus(mode==='hardware'?'SLOOP connected · WATCH sync active':'Virtual SLOOP online');}catch(e){setStatus(e instanceof Error?e.message:'Connection failed');}}
  return <main className="min-h-screen">
    <header className="sticky top-0 z-20 border-b border-white/8 bg-[#0c0f11]/90 px-4 py-3 backdrop-blur-xl"><div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-md border border-emerald-300/30 bg-emerald-300/10"><Waves className="text-emerald-300" size={19}/></div><div><b className="tracking-tight">SloopUI</b><div className="text-[10px] uppercase tracking-[.2em] text-zinc-500">hardware studio</div></div></div><div className="flex items-center gap-2"><div className="hidden text-right md:block"><div className={`text-xs ${connected?'text-emerald-300':'text-zinc-400'}`}>{status}</div><div className="text-[10px] text-zinc-600">{mode==='hardware'?'Direct Web MIDI / SysEx':'Tone.js virtual device'}</div></div><button onClick={()=>{setConnected(false);setMode(mode==='hardware'?'virtual':'hardware')}} className="rounded border border-white/10 px-3 py-2 text-xs"><Cpu size={14} className="mr-1 inline"/>{mode==='hardware'?'HARDWARE':'VIRTUAL'}</button><button onClick={connect} className={`rounded px-3 py-2 text-xs font-black ${connected?'bg-emerald-300 text-black':'bg-white text-black'}`}><CirclePower size={14} className="mr-1 inline"/>{connected?'ONLINE':'CONNECT'}</button></div></div></header>
    <div className="mx-auto grid max-w-[1800px] gap-4 p-4 xl:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hardware-panel hidden h-fit rounded-xl p-3 xl:block"><div className="mb-2 px-2 text-[10px] font-bold tracking-[.2em] text-zinc-600">STUDIO</div>{[[SlidersHorizontal,'Device'],[Layers3,'Sequence'],[Disc3,'Samples'],[Radio,'Effects'],[Cable,'Routing']].map(([Icon,label])=><button key={String(label)} className="mb-1 flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-zinc-300 hover:bg-white/5"><Icon size={15}/>{String(label)}</button>)}</aside>
      <div className="space-y-4"><DevicePanel/><Sequencer/><SampleEditor/></div>
    </div>
  </main>;
}
