import { useEffect, useMemo, useRef, useState } from 'react';
import { Cable, CirclePower, Cpu, Disc3, Layers3, Play, Radio, RefreshCw, SlidersHorizontal, Upload, Waves } from 'lucide-react';
import { SloopDeviceSession, type ParameterDescriptor, type SessionState } from '../core/SloopDeviceSession';
import { WebMidiSloopTransport } from '../core/WebMidiSloopTransport';
import { VirtualSloopTransport } from '../core/VirtualSloopTransport';

const emptyState: SessionState = { loading:false, connected:false, selectedTrack:0, tracks:[], descriptors:[], values:{}, steps:[], drumSteps:[], sampleSlots:[] };
const trackNames = ['SYNTH 1','SYNTH 2','SYNTH 3','DRUMS'];
const accents = ['emerald','amber','cyan','rose'];

function formatValue(d: ParameterDescriptor, value: number) {
  if (d.format === 11) return value ? 'ON' : 'OFF';
  if (d.format === 8 && d.enumValues[value - d.min]) return d.enumValues[value - d.min];
  if (d.format === 14) return `${50 + value / 4}%`;
  return `${value}${d.unit ? ` ${d.unit}` : ''}`;
}

function ParameterControl({ descriptor, value, onChange }:{descriptor:ParameterDescriptor;value:number;onChange:(v:number)=>void}) {
  const pct = descriptor.max === descriptor.min ? 0 : (value-descriptor.min)/(descriptor.max-descriptor.min);
  return <div className="rounded-lg border border-white/8 bg-black/20 p-3">
    <div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-black tracking-[.14em] text-zinc-500">{descriptor.label}</span><span className="font-mono text-[11px] text-emerald-200">{formatValue(descriptor,value)}</span></div>
    <div className="flex items-center gap-3">
      <div className="knob relative h-11 w-11 shrink-0 rounded-full"><span className="absolute left-1/2 top-1 h-4 w-0.5 origin-bottom -translate-x-1/2 rounded bg-white/80" style={{transform:`translateX(-50%) rotate(${-135+pct*270}deg)`}}/></div>
      <input aria-label={descriptor.label} className="w-full accent-emerald-300" type="range" min={descriptor.min} max={descriptor.max} step={1} value={value} onChange={e=>onChange(Number(e.target.value))}/>
    </div>
  </div>;
}

function DevicePanel({ state, session }:{state:SessionState;session:SloopDeviceSession}) {
  const params = state.descriptors.filter(d=>d.scope===0);
  const globals = state.descriptors.filter(d=>d.scope===1);
  const engine = state.tracks[state.selectedTrack]?.engine ?? 0;
  return <section className="hardware-panel rounded-xl p-4">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-3">
      <div><div className="text-[10px] font-black tracking-[.28em] text-emerald-300">SLOOP // FM-1</div><h2 className="text-lg font-semibold">{state.info?.engineNames[engine] ?? (state.selectedTrack===3?'DRUMS':'Device')}</h2></div>
      <div className="flex gap-2">{state.tracks.map((track,i)=><button key={i} onClick={()=>void session.selectTrack(i)} className={`rounded border px-3 py-1.5 text-xs font-bold ${i===state.selectedTrack?'border-emerald-300/60 bg-emerald-300/15 text-emerald-100':'border-white/10 text-zinc-400'}`}>{trackNames[i]??`TRK ${i+1}`}</button>)}</div>
    </div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">{params.map(d=><ParameterControl key={`p${d.id}`} descriptor={d} value={state.values[`0:${d.id}`]??d.defaultValue} onChange={v=>void session.setParameter(0,d.id,v)}/>)}</div>
    {globals.length>0&&<details className="mt-4"><summary className="cursor-pointer text-xs font-bold uppercase tracking-[.15em] text-zinc-500">Global controls</summary><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">{globals.map(d=><ParameterControl key={`g${d.id}`} descriptor={d} value={state.values[`1:${d.id}`]??d.defaultValue} onChange={v=>void session.setParameter(1,d.id,v)}/>)}</div></details>}
  </section>;
}

function Sequencer({state,session,onAudition}:{state:SessionState;session:SloopDeviceSession;onAudition:(note:number)=>void}) {
  const count=state.info?.stepCount??64;
  const isDrums=state.selectedTrack===3;
  if(isDrums) return <section className="hardware-panel rounded-xl p-4"><div className="mb-3 flex items-center justify-between"><div><b>Drum Grid</b><span className="ml-2 text-xs text-zinc-500">16 lanes × {count} steps</span></div><button onClick={()=>void session.refreshSequence()} className="rounded border border-white/10 px-2 py-1 text-xs"><RefreshCw size={12} className="mr-1 inline"/>refresh</button></div><div className="overflow-auto"><div className="min-w-[1050px] space-y-1">{Array.from({length:16},(_,lane)=><div key={lane} className="grid grid-cols-[72px_repeat(16,1fr)] gap-1"><span className="py-2 text-[10px] font-bold text-zinc-500">LANE {lane+1}</span>{Array.from({length:16},(_,step)=>{const on=state.drumSteps.find(x=>x.index===step)?.on[lane]??false;return <button key={step} onClick={()=>void session.setDrumLane(step,lane,!on)} className={`h-8 rounded border text-[9px] ${on?'border-rose-300/60 bg-rose-300/25 text-rose-100':'border-white/7 bg-black/20 text-zinc-700'}`}>{step+1}</button>})}</div>)}</div></div></section>;
  return <section className="hardware-panel rounded-xl p-4"><div className="mb-3 flex items-center justify-between"><div><b>Sequence</b><span className="ml-2 text-xs text-zinc-500">{count} steps · click to toggle · right now shown in 4×16 banks</span></div><button onClick={()=>void session.refreshSequence()} className="rounded border border-white/10 px-2 py-1 text-xs"><RefreshCw size={12} className="mr-1 inline"/>refresh</button></div><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">{Array.from({length:Math.ceil(count/16)},(_,bank)=><div key={bank} className="rounded-lg border border-white/7 bg-black/20 p-2"><div className="mb-2 text-[10px] font-bold text-zinc-600">{bank*16+1}–{Math.min(count,bank*16+16)}</div><div className="grid grid-cols-4 gap-1">{Array.from({length:16},(_,local)=>{const index=bank*16+local;if(index>=count)return null;const step=state.steps.find(x=>x.index===index);const active=!!step?.notes.length;return <button key={index} onClick={()=>{if(active&&step?.notes[0])onAudition(step.notes[0]);void session.toggleStep(index)}} className={`h-11 rounded border font-mono text-[10px] ${active?'border-emerald-300/60 bg-emerald-300/20 text-emerald-100':'border-white/7 bg-black/20 text-zinc-600'}`}>{active?noteName(step!.notes[0]):index+1}</button>})}</div></div>)}</div></section>;
}

function SampleEditor({state}:{state:SessionState}) {
  const canvas=useRef<HTMLCanvasElement>(null); const [buffer,setBuffer]=useState<AudioBuffer>(); const [name,setName]=useState('No local sample loaded');
  useEffect(()=>{if(!buffer||!canvas.current)return;const c=canvas.current,ctx=c.getContext('2d')!;c.width=c.clientWidth*devicePixelRatio;c.height=c.clientHeight*devicePixelRatio;ctx.clearRect(0,0,c.width,c.height);ctx.strokeStyle='#fcd34d';ctx.lineWidth=devicePixelRatio;const data=buffer.getChannelData(0),mid=c.height/2;ctx.beginPath();for(let x=0;x<c.width;x++){const i=Math.floor(x/c.width*data.length),y=mid-data[i]*mid*.9;x?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke()},[buffer]);
  async function load(file:File){const ac=new AudioContext();const b=await ac.decodeAudioData(await file.arrayBuffer());setBuffer(b);setName(file.name);await ac.close()}
  function transform(kind:'normalize'|'reverse'){if(!buffer)return;const ac=new AudioContext();const out=ac.createBuffer(buffer.numberOfChannels,buffer.length,buffer.sampleRate);for(let c=0;c<buffer.numberOfChannels;c++){const src=buffer.getChannelData(c),dst=out.getChannelData(c);dst.set(src);if(kind==='reverse')dst.reverse();else{let peak=0;for(const v of dst)peak=Math.max(peak,Math.abs(v));if(peak>0)for(let i=0;i<dst.length;i++)dst[i]/=peak}}setBuffer(out);void ac.close()}
  return <section className="hardware-panel rounded-xl p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><b>Sample Lab</b><div className="text-xs text-zinc-500">{name} {buffer?`· ${buffer.sampleRate} Hz · ${(buffer.duration).toFixed(2)} s`:''}</div></div><div className="flex flex-wrap gap-1 text-xs"><label className="cursor-pointer rounded border border-white/10 bg-white/4 px-2.5 py-1.5"><Upload size={13} className="mr-1 inline"/>LOAD<input className="hidden" type="file" accept="audio/*" onChange={e=>{const f=e.target.files?.[0];if(f)void load(f)}}/></label><button disabled={!buffer} onClick={()=>transform('normalize')} className="rounded border border-white/10 px-2.5 py-1.5 disabled:opacity-30">Normalize</button><button disabled={!buffer} onClick={()=>transform('reverse')} className="rounded border border-white/10 px-2.5 py-1.5 disabled:opacity-30">Reverse</button></div></div><canvas ref={canvas} className="h-40 w-full rounded border border-white/8 bg-black/35"/><div className="mt-3 grid gap-2 sm:grid-cols-3">{state.sampleSlots.map(slot=><div key={slot.index} className="rounded border border-white/8 bg-black/20 p-2 text-xs"><b>USR{slot.index+1}</b><span className="ml-2 text-zinc-500">{slot.zones?slot.name||'sample':'empty'} · {slot.dataKiB} KiB</span></div>)}</div></section>;
}

export function App(){
  const [mode,setMode]=useState<'hardware'|'virtual'>('virtual'); const [state,setState]=useState<SessionState>(emptyState); const [status,setStatus]=useState('Offline workspace ready');
  const transport=useMemo(()=>mode==='hardware'?new WebMidiSloopTransport():new VirtualSloopTransport(),[mode]); const session=useMemo(()=>new SloopDeviceSession(transport),[transport]);
  useEffect(()=>session.subscribe(setState),[session]); useEffect(()=>()=>{void session.disconnect()},[session]);
  async function connect(){try{setStatus(mode==='hardware'?'Requesting Web MIDI + SysEx…':'Starting virtual audio engine…');await session.connect();setStatus(mode==='hardware'?'SLOOP connected · live sync active':'Virtual SLOOP online')}catch(e){setStatus(e instanceof Error?e.message:'Connection failed')}}
  function audition(note:number){if(transport instanceof VirtualSloopTransport)transport.audition(midiToTone(note))}
  async function switchMode(){await session.disconnect().catch(()=>undefined);setState(emptyState);setMode(m=>m==='hardware'?'virtual':'hardware');setStatus('Mode changed · connect when ready')}
  return <main className="min-h-screen"><header className="sticky top-0 z-20 border-b border-white/8 bg-[#0c0f11]/90 px-4 py-3 backdrop-blur-xl"><div className="mx-auto flex max-w-[1900px] items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-md border border-emerald-300/30 bg-emerald-300/10"><Waves className="text-emerald-300" size={19}/></div><div><b>SloopUI</b><div className="text-[10px] uppercase tracking-[.2em] text-zinc-500">FM-1 hardware studio</div></div></div><div className="flex items-center gap-2"><div className="hidden text-right md:block"><div className={`text-xs ${state.connected?'text-emerald-300':state.error?'text-rose-300':'text-zinc-400'}`}>{state.loading?'Loading device…':state.error??status}</div><div className="text-[10px] text-zinc-600">{state.info?`${state.info.firmware} · protocol v${state.info.protocolVersion}`:mode==='hardware'?'Direct Web MIDI / SysEx':'Tone.js virtual device'}</div></div><button onClick={()=>void switchMode()} className="rounded border border-white/10 px-3 py-2 text-xs"><Cpu size={14} className="mr-1 inline"/>{mode.toUpperCase()}</button><button disabled={state.loading} onClick={()=>void (state.connected?session.disconnect():connect())} className={`rounded px-3 py-2 text-xs font-black ${state.connected?'bg-emerald-300 text-black':'bg-white text-black'} disabled:opacity-40`}><CirclePower size={14} className="mr-1 inline"/>{state.connected?'DISCONNECT':'CONNECT'}</button></div></div></header><div className="mx-auto grid max-w-[1900px] gap-4 p-4 xl:grid-cols-[190px_minmax(0,1fr)]"><aside className="hardware-panel hidden h-fit rounded-xl p-3 xl:block"><div className="mb-2 px-2 text-[10px] font-bold tracking-[.2em] text-zinc-600">STUDIO</div>{[[SlidersHorizontal,'Device'],[Layers3,'Sequence'],[Disc3,'Samples'],[Radio,'Effects'],[Cable,'Routing']].map(([Icon,label])=><div key={String(label)} className="mb-1 flex items-center gap-2 rounded px-3 py-2 text-sm text-zinc-300"><Icon size={15}/>{String(label)}</div>)}</aside><div className="space-y-4">{state.connected?<><DevicePanel state={state} session={session}/><Sequencer state={state} session={session} onAudition={audition}/><SampleEditor state={state}/></>:<section className="hardware-panel grid min-h-[520px] place-items-center rounded-xl p-8 text-center"><div className="max-w-lg"><Waves size={50} className="mx-auto mb-5 text-emerald-300"/><h1 className="text-3xl font-black">SLOOP Studio</h1><p className="mt-3 text-sm leading-6 text-zinc-400">Connect the FM-1 directly through Web MIDI/SysEx, or use Virtual mode to build patterns and audition ideas without hardware. The editor discovers firmware parameters dynamically instead of assuming a fixed engine layout.</p><button onClick={()=>void connect()} className="mt-6 rounded bg-emerald-300 px-5 py-2.5 text-sm font-black text-black"><Play size={14} className="mr-2 inline"/>START {mode.toUpperCase()}</button></div></section>}</div></div></main>
}

function noteName(note:number){const names=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];return `${names[note%12]}${Math.floor(note/12)-1}`}
function midiToTone(note:number){return noteName(note)}
