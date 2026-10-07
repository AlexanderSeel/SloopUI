import { useEffect, useState } from 'react';
import { getTrackSequenceLength, setTrackSequenceLength } from '../../features/sequencer/sequenceRuntime';
import { Sequencer as SequencerV2 } from './SequencerV2';

type Props=React.ComponentProps<typeof SequencerV2>;

export function Sequencer(props:Props){
 const maximum=Math.max(1,props.state.info?.stepCount??64),track=props.state.selectedTrack;
 const[length,setLength]=useState(()=>getTrackSequenceLength(track,maximum));
 useEffect(()=>setLength(getTrackSequenceLength(track,maximum)),[track,maximum]);
 function change(next:number){setLength(setTrackSequenceLength(track,next,maximum));}
 const quick=[8,16,32,48,64].filter((value,index,all)=>value<=maximum&&all.indexOf(value)===index);
 return <div className="space-y-2">
  <div className="hardware-panel flex flex-wrap items-center gap-2 rounded-xl px-3 py-2">
   <div className="mr-2"><div className="text-[9px] font-black uppercase tracking-[.14em] text-zinc-500">Pattern length</div><div className="text-[10px] text-zinc-600">{['Synth 1','Synth 2','Synth 3','Drums'][track]} · non-destructive loop length</div></div>
   <div className="flex overflow-hidden rounded-md border border-white/10 bg-black/25">{quick.map(value=><button key={value} onClick={()=>change(value)} className={`px-2.5 py-1.5 text-[10px] font-black ${length===value?'bg-emerald-300 text-black':'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>{value}</button>)}</div>
   <label className="ml-auto flex items-center gap-2 text-[9px] font-black uppercase tracking-[.12em] text-zinc-500">Steps<input className="input w-16 text-center font-mono text-xs" type="number" min={1} max={maximum} value={length} onChange={e=>change(Number(e.target.value))}/></label>
   <span className="text-[9px] text-zinc-600">1–{maximum}</span>
  </div>
  <SequencerV2 {...props}/>
 </div>;
}
