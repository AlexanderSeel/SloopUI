import { Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SessionState, SloopDeviceSession } from '../../core/SloopDeviceSession';

export function GlobalTransportBar({state,session}:{state:SessionState;session:SloopDeviceSession}){
 const descriptor=state.descriptors.find(d=>d.scope===1&&d.label.toUpperCase()==='BPM');
 const bpm=descriptor?state.values[`1:${descriptor.id}`]??descriptor.defaultValue:120;
 const[draft,setDraft]=useState(bpm),[busy,setBusy]=useState(false);
 useEffect(()=>setDraft(bpm),[bpm]);
 if(!descriptor)return null;
 const min=descriptor.min||20,max=descriptor.max||300;
 async function commit(value:number){const next=Math.max(min,Math.min(max,Math.round(value)));setDraft(next);setBusy(true);try{await session.setParameter(1,descriptor!.id,next);}finally{setBusy(false);}}
 return <div className="flex items-center overflow-hidden rounded-md border border-white/10 bg-black/30" title="Global tempo">
  <span className="border-r border-white/8 px-2 text-[9px] font-black tracking-[.12em] text-zinc-500">BPM</span>
  <button className="grid h-8 w-7 place-items-center text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-30" disabled={busy||draft<=min} onClick={()=>void commit(draft-1)} aria-label="Decrease BPM"><Minus size={11}/></button>
  <input className="h-8 w-14 border-x border-white/8 bg-transparent text-center font-mono text-[12px] font-black text-emerald-200 outline-none" type="number" min={min} max={max} value={draft} onChange={e=>setDraft(Number(e.target.value))} onBlur={()=>void commit(draft)} onKeyDown={e=>{if(e.key==='Enter'){e.currentTarget.blur();}}}/>
  <button className="grid h-8 w-7 place-items-center text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-30" disabled={busy||draft>=max} onClick={()=>void commit(draft+1)} aria-label="Increase BPM"><Plus size={11}/></button>
 </div>;
}
