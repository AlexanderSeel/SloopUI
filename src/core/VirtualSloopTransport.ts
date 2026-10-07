import * as Tone from 'tone';
import { encodeCString, encodeV14, readCString, SloopCommand, type SloopFrame } from '../protocol/sloopProtocol';
import type { ConnectionState, SloopTransport } from './WebMidiSloopTransport';

const PARAMS = [
 ['LEVEL',0,127,100,'%'],['ATTACK',0,127,8,''],['DECAY',0,127,54,''],['SUSTAIN',0,127,92,'%'],['RELEASE',0,127,44,''],
 ['FLT',-64,63,0,'%'],['PIT',-64,63,0,'%'],['SHP',-64,63,0,'%'],['FX',-64,63,0,'%'],['RATE',0,127,60,''],['WAVE',0,4,0,''],['PHS',0,127,0,''],['FADE',0,127,0,''],
 ['PIT',-64,63,0,'%'],['FLT',-64,63,0,'%'],['SHP',-64,63,0,'%'],['AMP',0,127,0,'%'],['DST',0,127,0,'%'],['CHO',0,127,0,'%'],['DLY',0,127,0,'%'],['REV',0,127,0,'%'],['PAN',-64,63,0,''],['MUTE',0,1,0,'']
] as const;
const GLOBALS = [
 ['BPM',40,240,120,'bpm'],['SWING',0,100,0,'%'],['MASTER',0,127,100,'%'],['DUST',0,127,0,'%'],['DUCK',0,127,0,'%'],['FILT',-64,63,0,''],['ROLL',0,4,1,''],['ENG',0,3,0,'']
] as const;
const FACTORY=[['INIT','WARM PAD','ACID BASS','PLUCK'],['GLASS','DIGI PAD','BELL','KEYS'],['FM BASS','EP','METAL','CHIME'],['SAMPLE INIT','LOOP','VOCAL','HIT']];

interface VirtualPreset { used:boolean; engine:number; name:string; values:number[]; }
export class VirtualSloopTransport implements SloopTransport {
 state:ConnectionState='idle'; private listeners=new Set<(frame:SloopFrame)=>void>(); private synth=new Tone.PolySynth(Tone.Synth).toDestination(); private selectedTrack=0;
 private values=Array.from({length:4},()=>PARAMS.map(p=>p[3] as number)); private globals=GLOBALS.map(p=>p[3] as number);
 private steps=Array.from({length:4},()=>Array.from({length:64},(_,index)=>({index,note:index%4===0?60+(index%12):0,velocity:100,level:100,ratchet:0,flags:0})));
 private drums=Array.from({length:64},(_,index)=>({on:index%4===0?1:0,levels:0xaaaaaaaa,ratchets:0}));
 private projects=Array.from({length:4},()=>false); private user=Array.from({length:32},(_,slot):VirtualPreset=>({used:slot<3,engine:slot%3,name:slot<3?`VIRTUAL ${slot+1}`:'',values:[...this.values[0]]}));
 private samples=[{zones:1,name:'KICK',kib:12},{zones:0,name:'',kib:0},{zones:0,name:'',kib:0}];
 async connect(){await Tone.start();this.state='connected';}
 async disconnect(){this.synth.releaseAll();Tone.Transport.stop();this.state='idle';}
 async request(command:SloopCommand,data:Iterable<number>=[]):Promise<SloopFrame>{
  const p=Uint8Array.from(data);
  if(command===SloopCommand.Ping)return frame(command,[0]); if(command===SloopCommand.Watch)return frame(command,[p[0]??0]);
  if(command===SloopCommand.Info)return frame(command,[...encodeCString('SLOOP VIRTUAL 2.0'),4,PARAMS.length,GLOBALS.length,64,Math.max(0,PARAMS.length-8),...encodeCString('ANALOG'),...encodeCString('WAVETABLE'),...encodeCString('FM'),...encodeCString('SAMPLE'),4,5]);
  if(command===SloopCommand.Track){if(p.length)this.selectedTrack=Math.min(3,p[0]);const tracks=Array.from({length:4},(_,i)=>[i===3?4:i,0,...encodeV14(this.values[i][0]),this.values[i][22]?1:0,0]).flat();return frame(command,[this.selectedTrack,4,...tracks,0]);}
  if(command===SloopCommand.TrackMix){const track=p[0]??0;if(p.length>=4){this.values[track][0]=decodeRaw(p[1],p[2]);this.values[track][22]=p[3]?1:0;}return frame(command,[track,...encodeV14(this.values[track][0]),this.values[track][22]?1:0]);}
  if(command===SloopCommand.Desc){const scope=p[0]??0,id=p[1]??0,source=scope?GLOBALS:PARAMS,item=source[id]??['P'+id,0,127,0,''];const[label,min,max,def,unit]=item as readonly[string,number,number,number,string];const enums=label==='MUTE'?['OFF','ON']:label==='WAVE'?['SIN','TRI','SAW','SQR','S&H']:label==='ROLL'?['1/8','1/16','1/32','32T','1/64']:label==='ENG'?['ANALOG','WAVETABLE','FM','SAMPLE']:[];const fmt=enums.length?8:label==='BPM'?9:label==='MUTE'?11:label==='FILT'?15:1;return frame(command,[scope,id,fmt,...encodeV14(min),...encodeV14(max),...encodeV14(def),...encodeCString(label),...encodeCString(unit),...enums.flatMap(encodeCString)]);}
  if(command===SloopCommand.Dump)return frame(command,[this.selectedTrack===3?4:this.selectedTrack,0,...this.values[this.selectedTrack].flatMap(encodeV14),...this.globals.flatMap(encodeV14)]);
  if(command===SloopCommand.Set){const scope=p[0]??0,id=p[1]??0,raw=decodeRaw(p[2],p[3]);if(scope){this.globals[id]=raw;if(GLOBALS[id]?.[0]==='ENG'){} }else this.values[this.selectedTrack][id]=raw;return frame(command,[scope,id,...encodeV14(raw)]);}
  if(command===SloopCommand.TrackParam){const track=p[0]??0,id=p[1]??0;if(p.length>=4)this.values[track][id]=decodeRaw(p[2],p[3]);return frame(command,[track,id,...encodeV14(this.values[track][id]??0)]);}
  if(command===SloopCommand.TrackStep){const track=p[0]??0,index=p[1]??0;if(p.length>2){const n=p[2]??0;this.steps[track][index]={index,note:n?(p[3]??60):0,velocity:p[4+n]??100,level:p[5+n]??100,ratchet:p[7+n]??0,flags:p[3+n]??0};}const s=this.steps[track][index];return frame(command,[track,index,s.note?1:0,...(s.note?[s.note]:[]),s.note?0:2,s.flags,s.velocity,s.level&0x7f,(s.level>>7)&0x7f,s.ratchet]);}
  if(command===SloopCommand.DrumStep){const index=p[0]??0;if(p.length>=14)this.drums[index]={on:from7(p.slice(1,4)),levels:from7(p.slice(4,9)),ratchets:from7(p.slice(9,14))};const d=this.drums[index];return frame(command,[index,...to7(d.on,3),...to7(d.levels,5),...to7(d.ratchets,5)]);}
  if(command===SloopCommand.Names){const engine=p[0]??0,names=FACTORY[engine]??FACTORY[0];return frame(command,[engine,names.length,...names.flatMap(encodeCString),...encodeCString('EDIT 1'),...encodeCString('EDIT 2')]);}
  if(command===SloopCommand.Project){const op=p[0]??2,slot=p[1]??0;if(op===1)this.projects[slot]=true;return frame(command,[op,slot,this.projects[slot]?1:0]);}
  if(command===SloopCommand.UserPresetList){const start=p[0]??0,count=Math.min(p[1]??16,16,32-start);const items=[] as number[];for(let i=0;i<count;i++){const u=this.user[start+i];items.push(u.used?1:0,u.engine,...encodeCString(u.used?u.name:''));}return frame(command,[start,count,32,...items]);}
  if(command===SloopCommand.UserPresetStore){const slot=p[0]??0,name=readCString(p,1).value||`VIRTUAL ${slot+1}`;this.user[slot]={used:true,engine:this.selectedTrack===3?0:this.selectedTrack,name,values:[...this.values[this.selectedTrack]]};return frame(command,[slot,0]);}
  if(command===SloopCommand.UserPresetLoad){const slot=p[0]??0,u=this.user[slot];if(!u?.used)return frame(command,[slot,1]);this.values[this.selectedTrack]=[...u.values];return frame(command,[slot,0]);}
  if(command===SloopCommand.UserPresetErase){const slot=p[0]??0;this.user[slot]={used:false,engine:0,name:'',values:[...this.values[0]]};return frame(command,[slot,0]);}
  if(command===SloopCommand.Preset){return frame(command,[p[0]??0,p[1]??0]);}
  if(command===SloopCommand.SampleInfo){return frame(command,[3,80,...this.samples.flatMap(s=>[s.zones,...encodeCString(s.name),s.kib])]);}
  if(command===SloopCommand.SampleBegin)return frame(command,[p[0]??0,0]);
  if(command===SloopCommand.SampleWrite)return frame(command,[p[0]??0,p[1]??0,p[2]??0,p[3]??0,0]);
  if(command===SloopCommand.SampleEnd){const slot=p[0]??0;this.samples[slot]={zones:1,name:'UPLOADED',kib:20};return frame(command,[slot,0]);}
  if(command===SloopCommand.SampleErase){const slot=p[0]??0;this.samples[slot]={zones:0,name:'',kib:0};return frame(command,[slot,0]);}
  return frame(command,[...p]);
 }
 subscribe(listener:(frame:SloopFrame)=>void){this.listeners.add(listener);return()=>this.listeners.delete(listener);}
 audition(note='C3',duration='8n'){this.synth.triggerAttackRelease(note,duration);}
}
function frame(command:SloopCommand,data:number[]):SloopFrame{return{command,data:Uint8Array.from(data.map(x=>x&0x7f))};}
function decodeRaw(lo=0,hi=64){return(lo|(hi<<7))-8192;}
function to7(value:number,count:number){return Array.from({length:count},(_,k)=>Math.floor(value/2**(7*k))&0x7f);}
function from7(bytes:Uint8Array){return Array.from(bytes).reduce((v,b,k)=>v+(b&0x7f)*2**(7*k),0);}
