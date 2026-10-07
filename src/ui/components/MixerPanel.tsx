import { useEffect, useMemo, useRef, useState } from 'react';
import type { SessionState, SloopDeviceSession } from '../../core/SloopDeviceSession';

const NAMES=['SYNTH 1','SYNTH 2','SYNTH 3','DRUMS'];

export function MixerPanel({state,session}:{state:SessionState;session:SloopDeviceSession}){
 const panDescriptor=state.descriptors.find(d=>d.scope===0&&d.label.toUpperCase()==='PAN');
 const selectedPan=panDescriptor?state.values[`0:${panDescriptor.id}`]??0:0;
 const panCache=useMemo(()=>new Map<number,number>(),[]);
 if(panDescriptor)panCache.set(state.selectedTrack,selectedPan);
 return <section className="hardware-panel mixer-panel rounded-xl p-3" id="mixer">
  <div className="mb-2 flex items-center justify-between border-b border-white/8 pb-2"><div><b>4-Track Mixer</b><span className="ml-2 text-[10px] text-zinc-500">hardware channel strips</span></div>{state.soloMask!==0&&<span className="text-[9px] text-amber-300">SOLO 0x{state.soloMask.toString(16)}</span>}</div>
  <div className="mixer-console">{state.tracks.map(track=>{const pan=panCache.get(track.index)??(track.index===state.selectedTrack?selectedPan:0),meter=Math.max(2,Math.round(track.level/127*100));return <div key={track.index} className={`mixer-strip ${state.selectedTrack===track.index?'mixer-strip-active':''}`}>
   <button className="channel-name" onClick={()=>void session.selectTrack(track.index)}>{NAMES[track.index]}</button><div className={`channel-led ${track.armed?'channel-led-on':''}`}>{track.armed?'REC':'SIG'}</div>
   <div className="mixer-pan"><span>L</span><input aria-label={`${NAMES[track.index]} pan`} type="range" min={panDescriptor?.min??-64} max={panDescriptor?.max??63} value={pan} onChange={e=>{const value=Number(e.target.value);panCache.set(track.index,value);void session.setTrackPan(track.index,value);}}/><span>R</span></div>
   <ContinuousFader track={track.index} value={track.level} mute={track.mute} meter={meter} session={session}/>
   <button onClick={()=>void session.setTrackMix(track.index,track.level,!track.mute)} className={`channel-mute ${track.mute?'channel-mute-on':''}`}>{track.mute?'MUTED':'MUTE'}</button>
  </div>})}</div>
 </section>;
}

function ContinuousFader({track,value,mute,meter,session}:{track:number;value:number;mute:boolean;meter:number;session:SloopDeviceSession}){
 const[local,setLocal]=useState(value);
 const dragging=useRef(false),lastSent=useRef(value),pending=useRef(value),timer=useRef<number|undefined>(undefined);
 useEffect(()=>{if(!dragging.current){setLocal(value);pending.current=value;lastSent.current=value;}},[value]);
 useEffect(()=>()=>{if(timer.current!==undefined)window.clearTimeout(timer.current);},[]);
 function flush(){timer.current=undefined;const next=pending.current;if(next===lastSent.current)return;lastSent.current=next;void session.setTrackMix(track,next,mute);}
 function queue(next:number,final=false){pending.current=next;setLocal(next);if(final){if(timer.current!==undefined)window.clearTimeout(timer.current);timer.current=undefined;flush();return;}if(timer.current===undefined)timer.current=window.setTimeout(flush,32);}
 function finish(e:React.PointerEvent<HTMLInputElement>){dragging.current=false;queue(Number(e.currentTarget.value),true);try{e.currentTarget.releasePointerCapture(e.pointerId);}catch{/* pointer may already be released */}}
 return <>
  <div className="mixer-fader-zone"><div className="fader-scale" aria-hidden="true"><span>+6</span><span>0</span><span>-12</span><span>-24</span><span>-∞</span></div><div className="meter-well" aria-hidden="true"><i style={{height:`${meter}%`}}/></div><div className="mixer-fader-wrap"><input aria-label={`${NAMES[track]} level`} className="mixer-fader" type="range" min={0} max={127} value={local} onPointerDown={e=>{dragging.current=true;e.currentTarget.setPointerCapture(e.pointerId);}} onPointerUp={finish} onPointerCancel={finish} onInput={e=>queue(Number(e.currentTarget.value))}/></div></div>
  <div className="mixer-db">{local}</div>
 </>;
}
