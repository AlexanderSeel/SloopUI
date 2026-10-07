import { useMemo, useState } from 'react';
import type { SessionState, SloopDeviceSession } from '../../core/SloopDeviceSession';

const NAMES=['SYNTH 1','SYNTH 2','SYNTH 3','DRUMS'];
export function MixerPanel({state,session}:{state:SessionState;session:SloopDeviceSession}){
  const [busy,setBusy]=useState<number>();
  const panDescriptor=state.descriptors.find(d=>d.scope===0&&d.label.toUpperCase()==='PAN');
  const selectedPan=panDescriptor?state.values[`0:${panDescriptor.id}`]??0:0;
  const panCache=useMemo(()=>new Map<number,number>(),[]);
  if(panDescriptor)panCache.set(state.selectedTrack,selectedPan);
  async function mix(track:number,level:number,mute:boolean){setBusy(track);try{await session.setTrackMix(track,level,mute);}finally{setBusy(undefined);}}
  return <section className="hardware-panel rounded-xl p-4" id="mixer">
    <div className="mb-3"><b>Track Mixer</b><span className="ml-2 text-xs text-zinc-500">hardware-backed level · pan · mute · REC status</span></div>
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">{state.tracks.map(track=><div key={track.index} className={`rounded-lg border p-3 ${state.selectedTrack===track.index?'border-emerald-300/40 bg-emerald-300/5':'border-white/8 bg-black/20'}`}>
      <div className="mb-3 flex items-center justify-between"><button className="text-xs font-black" onClick={()=>void session.selectTrack(track.index)}>{NAMES[track.index]??`TRACK ${track.index+1}`}</button><span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${track.armed?'bg-rose-400/20 text-rose-300':'bg-white/5 text-zinc-600'}`}>{track.armed?'REC ARMED':'REC'}</span></div>
      <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Level {track.level}<input className="mt-1 w-full accent-emerald-300" type="range" min={0} max={127} value={track.level} disabled={busy===track.index} onChange={e=>void mix(track.index,Number(e.target.value),track.mute)}/></label>
      <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>void mix(track.index,track.level,!track.mute)} className={`rounded border px-2 py-1.5 text-xs font-bold ${track.mute?'border-rose-300/50 bg-rose-300/15 text-rose-200':'border-white/10 text-zinc-500'}`}>{track.mute?'MUTED':'MUTE'}</button><button onClick={()=>void session.selectTrack(track.index)} className="rounded border border-white/10 px-2 py-1.5 text-xs">SELECT</button></div>
      {panDescriptor&&<label className="mt-3 block text-[9px] font-bold uppercase tracking-wider text-zinc-500">Pan {panCache.get(track.index)??(track.index===state.selectedTrack?selectedPan:0)}<input className="mt-1 w-full accent-cyan-300" type="range" min={panDescriptor.min} max={panDescriptor.max} defaultValue={panCache.get(track.index)??0} onChange={e=>{const value=Number(e.target.value);panCache.set(track.index,value);void session.setTrackPan(track.index,value);}}/></label>}
    </div>)}</div>
    {state.soloMask!==0&&<div className="mt-2 text-[10px] text-amber-300">Device solo mask: 0x{state.soloMask.toString(16)} (read-only in protocol v5 TRACK reply)</div>}
  </section>;
}
