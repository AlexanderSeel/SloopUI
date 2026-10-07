import { useMemo, useState } from 'react';
import { Activity, Gauge, RadioTower, Sparkles } from 'lucide-react';
import type { ParameterDescriptor, SessionState, SloopDeviceSession } from '../../core/SloopDeviceSession';
import { setAutomationLane } from '../../features/effects/automationStore';
import { ParameterControl } from './ParameterControl';

const GROUPS=[
 {title:'TRACK FX',icon:<Sparkles size={12}/>,labels:['DST','CHO','DLY','REV','FX']},
 {title:'SLICER',icon:<Activity size={12}/>,labels:['SLCR','PAT','RATE','DEPTH']},
 {title:'PERFORMANCE',icon:<Gauge size={12}/>,labels:['DUST','DUCK','FILT','ROLL']},
 {title:'LFO / MOD',icon:<RadioTower size={12}/>,labels:['WAVE','PHS','FADE','PIT','FLT','SHP','AMP']},
] as const;

export function EffectsRack({state,session,virtual}:{state:SessionState;session:SloopDeviceSession;virtual:boolean}){
 const[automation,setAutomation]=useState<Record<string,number[]>>({}),[showAutomation,setShowAutomation]=useState(false);
 const groups=useMemo(()=>GROUPS.map(group=>({...group,descriptors:uniqueDescriptors(state.descriptors,group.labels)})).filter(g=>g.descriptors.length),[state.descriptors]);
 function setPoint(key:string,index:number,value:number){setAutomation(current=>{const lane=Array.from({length:16},(_,i)=>i===index?value:(current[key]?.[i]??64));setAutomationLane(key,lane);return{...current,[key]:lane};});}
 return <section className="hardware-panel fx-rack rounded-xl p-3" id="effects">
  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-white/8 pb-2"><div><b>Effects & Modulation</b><span className="ml-2 text-[10px] text-zinc-500">dense insert / send rack</span></div><div className="flex gap-1"><button className={`tool ${showAutomation?'border-violet-300/40 text-violet-200':''}`} onClick={()=>setShowAutomation(v=>!v)}>AUTOMATION</button><span className={`rounded px-2 py-1 text-[9px] font-black ${virtual?'bg-violet-300/15 text-violet-200':'bg-emerald-300/10 text-emerald-200'}`}>{virtual?'VIRTUAL MAP':'HARDWARE'}</span></div></div>
  <div className="fx-rack-grid">{groups.map(group=><section key={group.title} className="fx-bay"><header className="fx-bay-title">{group.icon}<span>{group.title}</span></header><div className={`fx-bay-controls ${group.title==='LFO / MOD'?'fx-bay-controls-wide':''}`}>{group.descriptors.map(d=><ParameterControl compact key={`${d.scope}:${d.id}`} descriptor={d} value={state.values[`${d.scope}:${d.id}`]??d.defaultValue} onChange={value=>void session.setParameter(d.scope,d.id,value)}/>)}</div></section>)}</div>
  {showAutomation&&<section className="automation-drawer"><div className="mb-2 flex items-center justify-between"><div><b className="text-[10px]">Automation lanes</b><span className="ml-2 text-[9px] text-zinc-500">16 steps</span></div><span className="text-[8px] font-bold text-violet-200">{virtual?'ACTIVE DURING VIRTUAL PLAYBACK':'VIRTUAL-ONLY'}</span></div>{groups.flatMap(g=>g.descriptors).slice(0,6).map(d=>{const key=`${d.scope}:${d.id}`,base=state.values[key]??d.defaultValue,points=automation[key]??Array(16).fill(Math.round(((base-d.min)/Math.max(1,d.max-d.min))*127));return <div key={key} className="automation-row"><span>{d.label}</span>{points.map((value,index)=><input key={index} aria-label={`${d.label} automation ${index+1}`} type="range" min={0} max={127} value={value} onChange={e=>setPoint(key,index,Number(e.target.value))}/>)}</div>;})}</section>}
 </section>;
}
function uniqueDescriptors(all:ParameterDescriptor[],labels:readonly string[]){const seen=new Set<string>(),output:ParameterDescriptor[]=[];for(const label of labels)for(const d of all.filter(x=>x.label.toUpperCase()===label)){const key=`${d.scope}:${d.id}`;if(!seen.has(key)){seen.add(key);output.push(d);}}return output;}
