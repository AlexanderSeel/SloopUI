import { useMemo, useRef, useState } from 'react';
import type { SessionState, SloopDeviceSession, StepData } from '../../core/SloopDeviceSession';

const ROW_H=22,CELL_W=46,MIN_NOTE=36,MAX_NOTE=84;
type NoteBlock={note:number;start:number;length:number;velocity:number;level:number;ratchet:number;flags:number};

type Props={state:SessionState;session:SloopDeviceSession;first:number;visible:number;playhead:number};
export function EditablePianoRoll({state,session,first,visible,playhead}:Props){
 const[selected,setSelected]=useState<NoteBlock|null>(null),[message,setMessage]=useState('');
 const blocks=useMemo(()=>buildBlocks(state.steps,first,visible),[state.steps,first,visible]);
 const width=visible*CELL_W,height=(MAX_NOTE-MIN_NOTE+1)*ROW_H;
 async function addAt(step:number,note:number){const current=state.steps.find(s=>s.index===step)??emptyStep(step);if(current.notes.includes(note)||current.notes.length>=4)return;await session.setStep({...current,notes:[...current.notes,note],time:0});setSelected({note,start:step,length:1,velocity:current.velocity||100,level:current.level||100,ratchet:current.ratchet||0,flags:current.flags||0});}
 async function replaceBlock(block:NoteBlock,next:{note:number;start:number;length:number}){
  const note=Math.max(0,Math.min(127,next.note)),start=Math.max(0,Math.min((state.info?.stepCount??64)-1,next.start)),length=Math.max(1,Math.min(next.length,(state.info?.stepCount??64)-start));
  const touched=new Map<number,StepData>();
  const get=(index:number)=>{let step=touched.get(index);if(!step){const src=state.steps.find(s=>s.index===index)??emptyStep(index);step={...src,notes:[...src.notes]};touched.set(index,step);}return step;};
  for(let i=0;i<block.length;i++){const index=block.start+i,step=get(index);step.notes=step.notes.filter(n=>n!==block.note);if(!step.notes.length)step.time=2;}
  for(let i=0;i<length;i++){const index=start+i,step=get(index);if(!step.notes.includes(note))step.notes=[...step.notes,note].slice(0,4);step.time=i===0?0:1;if(i===0){step.velocity=block.velocity;step.level=block.level;step.ratchet=block.ratchet;step.flags=block.flags;}}
  await session.applySteps([...touched.values()].sort((a,b)=>a.index-b.index));
  setSelected({...block,note,start,length});setMessage(`${noteName(note)} · step ${start+1} · ${length} step${length===1?'':'s'}`);
 }
 async function patchEffects(patch:Partial<Pick<NoteBlock,'velocity'|'level'|'ratchet'|'flags'>>){if(!selected)return;const firstStep=state.steps.find(s=>s.index===selected.start)??emptyStep(selected.start);const next={...selected,...patch};await session.setStep({...firstStep,velocity:next.velocity,level:next.level,ratchet:next.ratchet,flags:next.flags});setSelected(next);}
 return <div className="piano-editor-shell">
  <div className="piano-editor-toolbar"><div><b>PIANO ROLL</b><span> drag notes · resize handles · wheel transposes · click empty grid to insert</span></div><span>{message}</span></div>
  <div className="piano-editor-scroll"><div className="piano-editor-ruler" style={{width:width+58}}><span/>{Array.from({length:visible},(_,i)=><b key={i}>{first+i+1}</b>)}</div><div className="piano-editor-body" style={{width:width+58,height}}>
   <div className="piano-keys" style={{height}}>{Array.from({length:MAX_NOTE-MIN_NOTE+1},(_,row)=>{const note=MAX_NOTE-row;return <button key={note} className={`piano-key ${isBlack(note)?'black':''}`} style={{top:row*ROW_H,height:ROW_H}}>{noteName(note)}</button>;})}</div>
   <div className="piano-grid" style={{left:58,width,height}}>{Array.from({length:MAX_NOTE-MIN_NOTE+1},(_,row)=>{const note=MAX_NOTE-row;return Array.from({length:visible},(_,col)=>{const step=first+col;return <button key={`${note}:${step}`} className={`piano-grid-cell ${isBlack(note)?'black':''} ${playhead===step?'playhead':''}`} style={{left:col*CELL_W,top:row*ROW_H,width:CELL_W,height:ROW_H}} onDoubleClick={()=>void addAt(step,note)} aria-label={`Insert ${noteName(note)} at step ${step+1}`}/>;});})}{blocks.map(block=><PianoNoteBlock key={`${block.note}:${block.start}`} block={block} first={first} selected={selected?.note===block.note&&selected.start===block.start} onSelect={()=>setSelected(block)} onChange={next=>void replaceBlock(block,next)}/>)}</div>
  </div></div>
  {selected&&<div className="piano-note-inspector"><div><div className="field">NOTE</div><b>{noteName(selected.note)}</b><span> · step {selected.start+1} · length {selected.length}</span></div><label className="field">VELOCITY {selected.velocity}<input type="range" min={1} max={127} value={selected.velocity} onChange={e=>void patchEffects({velocity:Number(e.target.value)})}/></label><label className="field">LEVEL {selected.level}<input type="range" min={0} max={255} value={selected.level} onChange={e=>void patchEffects({level:Number(e.target.value)})}/></label><label className="field">RATCHET<select className="select" value={selected.ratchet} onChange={e=>void patchEffects({ratchet:Number(e.target.value)})}><option value={0}>Off</option><option value={1}>2×</option><option value={2}>3×</option><option value={3}>4×</option></select></label><button className={`tool ${selected.flags&1?'text-amber-200':''}`} onClick={()=>void patchEffects({flags:selected.flags^1})}>ACCENT</button><button className={`tool ${selected.flags&2?'text-cyan-200':''}`} onClick={()=>void patchEffects({flags:selected.flags^2})}>SLIDE</button><button className="tool" onClick={()=>void replaceBlock(selected,{note:selected.note-12,start:selected.start,length:selected.length})}>-OCT</button><button className="tool" onClick={()=>void replaceBlock(selected,{note:selected.note+12,start:selected.start,length:selected.length})}>+OCT</button></div>}
 </div>;
}

function PianoNoteBlock({block,first,selected,onSelect,onChange}:{block:NoteBlock;first:number;selected:boolean;onSelect:()=>void;onChange:(next:{note:number;start:number;length:number})=>void}){const drag=useRef<{mode:'move'|'left'|'right';x:number;y:number}|null>(null);const row=MAX_NOTE-block.note,left=(block.start-first)*CELL_W,top=row*ROW_H;
 function begin(mode:'move'|'left'|'right',e:React.PointerEvent){e.preventDefault();e.stopPropagation();onSelect();drag.current={mode,x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}
 function end(e:React.PointerEvent){const d=drag.current;if(!d)return;drag.current=null;const dx=Math.round((e.clientX-d.x)/CELL_W),dy=Math.round((d.y-e.clientY)/ROW_H);if(d.mode==='move')onChange({note:block.note+dy,start:block.start+dx,length:block.length});else if(d.mode==='left'){const shift=Math.max(-(block.start),Math.min(block.length-1,dx));onChange({note:block.note,start:block.start+shift,length:block.length-shift});}else onChange({note:block.note,start:block.start,length:Math.max(1,block.length+dx)});}
 function wheel(e:React.WheelEvent){e.preventDefault();e.stopPropagation();const semitones=(e.shiftKey?12:1)*(e.deltaY>0?-1:1);onChange({note:block.note+semitones,start:block.start,length:block.length});}
 return <div className={`piano-note-block ${selected?'selected':''}`} style={{left,top,width:Math.max(14,block.length*CELL_W-2),height:ROW_H-2}} onPointerDown={e=>begin('move',e)} onPointerUp={end} onWheel={wheel}><i className="resize left" onPointerDown={e=>begin('left',e)} onPointerUp={end}/><span>{noteName(block.note)}<small>{block.length>1?` ×${block.length}`:''}</small></span><i className="resize right" onPointerDown={e=>begin('right',e)} onPointerUp={end}/></div>;
}
function buildBlocks(steps:StepData[],first:number,visible:number){const out:NoteBlock[]=[];const end=first+visible;for(let note=MIN_NOTE;note<=MAX_NOTE;note++){let i=first;while(i<end){const s=steps.find(x=>x.index===i);if(!s?.notes.includes(note)){i++;continue;}const start=i,velocity=s.velocity,level=s.level,ratchet=s.ratchet,flags=s.flags;i++;while(i<end){const next=steps.find(x=>x.index===i);if(!next?.notes.includes(note)||next.time!==1)break;i++;}out.push({note,start,length:i-start,velocity,level,ratchet,flags});}}return out;}
function emptyStep(index:number):StepData{return{index,notes:[],time:2,flags:0,velocity:100,level:100,ratchet:0};}
function noteName(note:number){const names=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];return`${names[(note%12+12)%12]}${Math.floor(note/12)-1}`;}
function isBlack(note:number){return[1,3,6,8,10].includes((note%12+12)%12);}
