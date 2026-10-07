import { useMemo, useState } from 'react';
import { Activity, Gauge, RadioTower, Sparkles } from 'lucide-react';
import type { ParameterDescriptor, SessionState, SloopDeviceSession } from '../../core/SloopDeviceSession';
import { ParameterControl } from './ParameterControl';

const GROUPS=[
 {title:'Track FX',icon:<Sparkles size={15}/>,labels:['DST','CHO','DLY','REV','FX']},
 {title:'Slicer',icon:<Activity size={15}/>,labels:['SLCR','PAT','RATE','DEPTH']},
 {title:'Performance FX',icon:<Gauge size={15}/>,labels:['DUST','DUCK','FILT','ROLL']},
 {title:'Modulation',icon:<RadioTower size={15}/>,labels:['WAVE','PHS','FADE','PIT','FLT','SHP','AMP']},
] as const;

export function EffectsRack({state,session,virtual}:{state:SessionState;session:SloopDeviceSession;virtual:boolean}){
 const [automation,setAutomation]=useState<Record<string,number[]>>({});
 const groups=useMemo(()=>GROUPS.map(group=>({...group,descriptors:uniqueDescriptors(state.descriptors,group.labels)})).filter(g=>g.descriptors.length),[state.descriptors]);
 function setPoint(key:string,index:number,value:number){setAutomation(current=>({...current,[key]:Array.from({length:16},(_,i)=>i===index?value:(current[key]?.[i]??64))}));}
 return <section className="hardware-panel rounded-xl p-4" id="effects">
  <div className="mb-3 flex items-center justify-between"><div><b>Effects & Modulation</b><span className="ml-2 text-xs text-zinc-500">semantic view over firmware descriptors</span></div><span className={`rounded px-2 py-1 text-[9px] font-black ${virtual?'bg-violet-300/15 text-violet-200':'bg-emerald-300/10 text-emerald-200'}`}>{virtual?'VIRTUAL + HARDWARE MAP':'HARDWARE BACKED'}</span></div>
  <div className="grid gap-3 xl:grid-cols-2">{groups.map(group=><div key={group.title} className="rounded-lg border border-white/8 bg-black/20 p-3"><div className="mb-2 flex items-center gap-2 text-xs font-black">{group.icon}{group.title}</div><div className="grid gap-2 md:grid-cols-2">{group.descriptors.map(d=><ParameterControl key={`${d.scope}:${d.id}`} descriptor={d} value={state.values[`${d.scope}:${d.id}`]??d.defaultValue} onChange={value=>void session.setParameter(d.scope,d.id,value)}/>)}</div></div>)}</div>
  <div className="mt-3 rounded-lg border border-violet-300/15 bg-violet-300/5 p-3"><div className="mb-2 flex items-center justify-between"><div><b className="text-xs">Automation lanes</b><span className="ml-2 text-[10px] text-zinc-500">16-step modulation sketch</span></div><span className="text-[9px] font-bold text-violet-200">{virtual?'ACTIVE IN VIRTUAL MODE':'VIRTUAL-ONLY · NOT SENT TO FM-1'}</span></div>
   {(groups.flatMap(g=>g.descriptors).slice(0,4)).map(d=>{const key=`${d.scope}:${d.id}`;const points=automation[key]??Array(16).fill(64);return <div key={key} className="mb-2 grid grid-cols-[90px_repeat(16,1fr)] items-end gap-1"><span className="truncate pb-2 text-[9px] font-bold text-zinc-500">{d.label}</span>{points.map((value,index)=><input key={index} aria-label={`${d.label} automation ${index+1}`} type="range" min={0} max={127} value={value} onChange={e=>setPoint(key,index,Number(e.target.value))} className="h-14 w-full appearance-none bg-transparent [writing-mode:vertical-lr] accent-violet-300"/>)}</div>;})}
  </div>
 </section>;
}
function uniqueDescriptors(all:ParameterDescriptor[],labels:readonly string[]){const seen=new Set<string>();const output:ParameterDescriptor[]=[];for(const label of labels){for(const d of all.filter(x=>x.label.toUpperCase()===label)){const key=`${d.scope}:${d.id}`;if(!seen.has(key)){seen.add(key);output.push(d);}}}return output;}
