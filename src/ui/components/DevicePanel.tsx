import { useMemo, useState } from 'react';
import type { ParameterDescriptor, SessionState, SloopDeviceSession } from '../../core/SloopDeviceSession';
import { ParameterControl } from './ParameterControl';
import { SynthVisualizer, type SynthVisualKind } from './SynthVisualizers';

const TRACK_NAMES=['SYNTH 1','SYNTH 2','SYNTH 3','DRUMS'];
type GroupName='OSC / SOURCE'|'FILTER'|'AMP ENV'|'LFO / MOD'|'ENV / SHAPE'|'ARP / SEQ'|'VOICE / PLAY'|'FX / SPACE'|'PERFORMANCE'|'CLOCK / MASTER'|'DELAY / REVERB'|'SYSTEM';
const FEATURED:GroupName[]=['FILTER','AMP ENV','LFO / MOD'];

export function DevicePanel({state,session}:{state:SessionState;session:SloopDeviceSession}){
 const[page,setPage]=useState<'synth'|'global'>('synth');
 const parameters=state.descriptors.filter(d=>d.scope===0),globals=state.descriptors.filter(d=>d.scope===1);
 const engine=state.tracks[state.selectedTrack]?.engine??0,title=state.selectedTrack===3?'DRUMS':state.info?.engineNames[engine]??'Device';
 const groups=useMemo(()=>page==='synth'?groupTrackDescriptors(parameters,state.info?.engineParameterStart??50):groupGlobalDescriptors(globals),[parameters,globals,page,state.info?.engineParameterStart]);
 const featured=page==='synth'&&state.selectedTrack<3?FEATURED.map(name=>groups.find(g=>g.name===name)).filter(Boolean) as {name:GroupName;items:ParameterDescriptor[]}[]:[];
 const rest=groups.filter(g=>!featured.some(f=>f.name===g.name));
 return <section className="hardware-panel synth-console rounded-xl p-3">
  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/8 pb-2">
   <div><div className="text-[9px] font-black tracking-[.24em] text-emerald-300">SLOOP // FM-1</div><div className="flex items-baseline gap-2"><h2 className="text-base font-semibold">{title}</h2><span className="text-[9px] text-zinc-600">signal-flow editor</span></div></div>
   <div className="flex flex-wrap items-center gap-1">{state.tracks.map((track,index)=><button key={track.index} onClick={()=>void session.selectTrack(index)} className={`rounded border px-2.5 py-1 text-[10px] font-black ${index===state.selectedTrack?'border-emerald-300/60 bg-emerald-300/15 text-emerald-100':'border-white/10 text-zinc-500'}`}>{TRACK_NAMES[index]}{track.mute?' · M':''}</button>)}<span className="mx-1 h-5 w-px bg-white/10"/><button onClick={()=>setPage('synth')} className={`tool ${page==='synth'?'bg-white/10 text-white':''}`}>SYNTH</button><button onClick={()=>setPage('global')} className={`tool ${page==='global'?'bg-white/10 text-white':''}`}>GLOBAL</button></div>
  </div>
  {featured.length>0&&<div className="synth-feature-grid">{FEATURED.map(name=>{const group=featured.find(g=>g.name===name);if(!group)return <div key={name}/>;const visual:SynthVisualKind=name==='FILTER'?'filter':name==='AMP ENV'?'adsr':'lfo';return <ControlGroup featured key={name} name={name} descriptors={group.items} state={state} session={session} visual={visual}/>;})}</div>}
  <div className="synth-rack-grid">{rest.map(group=><ControlGroup key={group.name} name={group.name} descriptors={group.items} state={state} session={session}/>)}</div>
 </section>;
}

function ControlGroup({name,descriptors,state,session,visual,featured=false}:{name:string;descriptors:ParameterDescriptor[];state:SessionState;session:SloopDeviceSession;visual?:SynthVisualKind;featured?:boolean}){
 const scope=descriptors[0]?.scope??0;
 return <section className={`synth-module ${featured?'synth-module-featured':''}`}><div className="synth-module-title"><span>{name}</span><i/></div>{visual&&<SynthVisualizer state={state} kind={visual}/>}<div className="synth-control-row">{descriptors.map(d=><ParameterControl compact key={`${d.scope}:${d.id}`} descriptor={d} value={state.values[`${d.scope}:${d.id}`]??d.defaultValue} onChange={value=>void session.setParameter(scope,d.id,value)}/>)}</div></section>;
}

function groupTrackDescriptors(items:ParameterDescriptor[],engineStart:number){
 const map=new Map<GroupName,ParameterDescriptor[]>();
 const put=(name:GroupName,d:ParameterDescriptor)=>map.set(name,[...(map.get(name)??[]),d]);
 for(const d of items){
  const label=d.label.toUpperCase();let name:GroupName;
  if(d.id>=engineStart){name=/CUT|RES|TONE|FILT/.test(label)?'FILTER':'OSC / SOURCE';}
  else if(d.id===0||d.id===43||d.id===44)name='PERFORMANCE';
  else if(d.id>=1&&d.id<=4)name='AMP ENV';
  else if(d.id===5)name='FILTER';
  else if(d.id>=6&&d.id<=8)name='ENV / SHAPE';
  else if(d.id>=9&&d.id<=16)name='LFO / MOD';
  else if(d.id>=17&&d.id<=32)name='ARP / SEQ';
  else if(d.id>=33&&d.id<=36)name='FX / SPACE';
  else if(d.id>=37&&d.id<=49)name='VOICE / PLAY';
  else name='OSC / SOURCE';
  put(name,d);
 }
 const order:GroupName[]=['OSC / SOURCE','FILTER','AMP ENV','LFO / MOD','ENV / SHAPE','ARP / SEQ','VOICE / PLAY','FX / SPACE','PERFORMANCE'];
 return order.filter(n=>map.has(n)).map(name=>({name,items:map.get(name)!}));
}
function groupGlobalDescriptors(items:ParameterDescriptor[]){
 const map=new Map<GroupName,ParameterDescriptor[]>();const put=(name:GroupName,d:ParameterDescriptor)=>map.set(name,[...(map.get(name)??[]),d]);
 for(const d of items){const l=d.label.toUpperCase();let name:GroupName='SYSTEM';if(/BPM|SWING|CLICK|TUNE|MASTER/.test(l))name='CLOCK / MASTER';else if(/TIME|FDBK|COLR|MIX|SIZE|DAMP|CRT|CDP/.test(l))name='DELAY / REVERB';else if(/DUST|DUCK|FILT|ROLL/.test(l))name='FX / SPACE';put(name,d);}const order:GroupName[]=['CLOCK / MASTER','DELAY / REVERB','FX / SPACE','SYSTEM'];return order.filter(n=>map.has(n)).map(name=>({name,items:map.get(name)!}));
}
