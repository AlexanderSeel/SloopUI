import * as Tone from 'tone';
import { VirtualStudioEngine, type VirtualBounceEvent } from '../audio/VirtualStudioEngine';
import { ENGINE_PARAMETER_START, GLOBAL_DESCRIPTORS, TRACK_COMMON, TRACK_PARAMETER_COUNT, engineDescriptors, type VirtualDescriptor } from '../audio/virtualFirmwareDescriptors';
import { factoryPatch } from '../audio/virtualFactoryPatches';
import { SLOOP_DEFAULT_DRUM_KIT, SLOOP_DRUM_KITS, SLOOP_DRUM_NOTES, SLOOP_FACTORY_PRESETS, SLOOP_VIRTUAL_ENGINES, type SloopVirtualEngine } from '../audio/virtualProfiles';
import { encodeCString, encodeV14, readCString, SloopCommand, type SloopFrame } from '../protocol/sloopProtocol';
import type { ConnectionState, SloopTransport } from './WebMidiSloopTransport';

const IDX={LVL:0,ATK:1,DEC:2,SUS:3,REL:4,ED_FLT:5,DST:33,CHO:34,DLY:35,REV:36,PAN:39,MUTE:40,E0:ENGINE_PARAMETER_START} as const;
const G={BPM:0,ENG:20} as const;
interface VirtualPreset{used:boolean;engine:number;preset:number;name:string;values:number[]}
interface VStep{index:number;notes:number[];time:number;flags:number;velocity:number;level:number;ratchet:number}
interface VDrum{on:number;levels:number;ratchets:number}
interface VirtualProject{engines:number[];presets:number[];values:number[][];globals:number[];steps:VStep[][];drums:VDrum[]}

export class VirtualSloopTransport implements SloopTransport{
 state:ConnectionState='idle';
 private listeners=new Set<(frame:SloopFrame)=>void>();
 private studio=new VirtualStudioEngine();
 private selectedTrack=0;
 private engines=[0,1,2,0];
 private presets=[0,0,0,0];
 private values=Array.from({length:4},(_,track)=>this.defaultTrack(track<3?this.engines[track]:0));
 private globals=GLOBAL_DESCRIPTORS.map(d=>d.defaultValue);
 private steps:VStep[][]=Array.from({length:4},()=>Array.from({length:64},(_,index)=>({index,notes:index%4===0?[60+(index%12)]:[],time:index%4===0?0:2,flags:0,velocity:100,level:100,ratchet:0})));
 private drums:VDrum[]=Array.from({length:64},(_,index)=>({on:index%4===0?1:0,levels:0xaaaaaaaa,ratchets:0}));
 private projects:Array<VirtualProject|undefined>=Array(4).fill(undefined);
 private user=Array.from({length:32},(_,slot):VirtualPreset=>({used:slot<3,engine:slot%3,preset:0,name:slot<3?`VIRTUAL ${slot+1}`:'',values:[...this.values[0]]}));
 private samples=[{zones:1,name:'KICK',kib:12},{zones:0,name:'',kib:0},{zones:0,name:'',kib:0}];
 constructor(){this.values[3][IDX.E0]=SLOOP_DEFAULT_DRUM_KIT;this.applyFactoryPatch(0,0,0);this.applyFactoryPatch(1,1,0);this.applyFactoryPatch(2,2,0);}

 async connect(){await this.studio.start();this.state='connected';this.syncAll();}
 async resumeAudio(){await this.studio.resumeAudio();}
 async disconnect(){Tone.Transport.stop();this.studio.dispose();this.studio=new VirtualStudioEngine();this.state='idle';}
 subscribe(listener:(frame:SloopFrame)=>void){this.listeners.add(listener);return()=>this.listeners.delete(listener);}

 async request(command:SloopCommand,data:Iterable<number>=[]):Promise<SloopFrame>{
  const p=Uint8Array.from(data);
  switch(command){
   case SloopCommand.Ping:return frame(command,[0]);
   case SloopCommand.Watch:return frame(command,[p[0]??0]);
   case SloopCommand.Info:return frame(command,[...encodeCString('SLOOP VIRTUAL 4.2'),SLOOP_VIRTUAL_ENGINES.length,TRACK_PARAMETER_COUNT,GLOBAL_DESCRIPTORS.length,64,ENGINE_PARAMETER_START,...SLOOP_VIRTUAL_ENGINES.flatMap(encodeCString),4,5]);
   case SloopCommand.Track:return this.trackReply(command,p);
   case SloopCommand.TrackMix:return this.trackMixReply(command,p);
   case SloopCommand.Desc:return this.descReply(command,p);
   case SloopCommand.Dump:return frame(command,[this.trackEngine(this.selectedTrack),this.presets[this.selectedTrack]??0,...this.values[this.selectedTrack].flatMap(encodeV14),...this.globals.flatMap(encodeV14)]);
   case SloopCommand.Set:return this.setReply(command,p);
   case SloopCommand.TrackParam:return this.trackParamReply(command,p);
   case SloopCommand.TrackStep:return this.trackStepReply(command,p);
   case SloopCommand.DrumStep:return this.drumStepReply(command,p);
   case SloopCommand.Names:return this.namesReply(command,p);
   case SloopCommand.Project:return this.projectReply(command,p);
   case SloopCommand.UserPresetList:return this.userListReply(command,p);
   case SloopCommand.UserPresetStore:return this.userStoreReply(command,p);
   case SloopCommand.UserPresetLoad:return this.userLoadReply(command,p);
   case SloopCommand.UserPresetErase:return this.userEraseReply(command,p);
   case SloopCommand.Preset:return this.presetReply(command,p);
   case SloopCommand.SampleInfo:return frame(command,[3,80,...this.samples.flatMap(s=>[s.zones,...encodeCString(s.name),s.kib])]);
   case SloopCommand.SampleBegin:return frame(command,[p[0]??0,0]);
   case SloopCommand.SampleWrite:return frame(command,[p[0]??0,p[1]??0,p[2]??0,p[3]??0,0]);
   case SloopCommand.SampleEnd:{const slot=Math.min(2,p[0]??0);this.samples[slot]={zones:1,name:'UPLOADED',kib:20};return frame(command,[slot,0]);}
   case SloopCommand.SampleErase:{const slot=Math.min(2,p[0]??0);this.samples[slot]={zones:0,name:'',kib:0};return frame(command,[slot,0]);}
   default:return frame(command,[...p]);
  }
 }

 audition(note='C3',duration='8n',track=this.selectedTrack,velocity=.85){this.studio.trigger(track,note,duration,velocity);}
 async loadTrackSample(track:number,buffer:AudioBuffer,root='C3'){await this.studio.setTrackSample(track,buffer,root);}
 clearTrackSample(track:number){this.studio.clearTrackSample(track);}
 async loadDrumSample(lane:number,buffer:AudioBuffer){await this.studio.setSample(lane,buffer);}
 clearDrumSample(lane:number){this.studio.clearSample(lane);}
 triggerDrumSample(lane:number,velocity=.8){if(!this.studio.triggerSample(lane))this.studio.triggerDrumLane(lane,this.values[3][IDX.E0]??SLOOP_DEFAULT_DRUM_KIT,velocity);}
 async bounce(events:VirtualBounceEvent[],seconds:number){return this.studio.bounce(events,seconds);}
 async bounceSong(bpm=this.globals[G.BPM]??90,stepCount=64){
  const stepSeconds=60/Math.max(20,bpm)/4,events:VirtualBounceEvent[]=[];
  for(let track=0;track<3;track++){
   const engine=SLOOP_VIRTUAL_ENGINES[this.engines[track]??0]??'ANALOG',preset=this.presets[track]??0;
   for(const s of this.steps[track])for(const note of s.notes)events.push({time:s.index*stepSeconds,track,note:midiToTone(note),duration:stepSeconds*.8,velocity:Math.max(.05,Math.min(1,s.velocity/127)),engine,preset});
  }
  for(let index=0;index<Math.min(stepCount,this.drums.length);index++){const d=this.drums[index];for(let lane=0;lane<16;lane++)if((d.on>>lane)&1)events.push({time:index*stepSeconds,track:3,lane,note:midiToTone(SLOOP_DRUM_NOTES[lane]),duration:stepSeconds*.3,velocity:.75});}
  return this.studio.bounce(events,Math.max(stepSeconds,stepCount*stepSeconds));
 }

 private trackReply(command:SloopCommand,p:Uint8Array){if(p.length)this.selectedTrack=Math.min(3,p[0]);const tracks=Array.from({length:4},(_,i)=>[this.trackEngine(i),this.presets[i]??0,...encodeV14(this.values[i][IDX.LVL]??104),this.values[i][IDX.MUTE]?1:0,0]).flat();return frame(command,[this.selectedTrack,4,...tracks,0]);}
 private trackMixReply(command:SloopCommand,p:Uint8Array){const track=Math.min(3,p[0]??0);if(p.length>=4){this.values[track][IDX.LVL]=clamp(decodeRaw(p[1],p[2]),0,127);this.values[track][IDX.MUTE]=p[3]?1:0;this.syncTrack(track);}return frame(command,[track,...encodeV14(this.values[track][IDX.LVL]),this.values[track][IDX.MUTE]?1:0]);}
 private drumKitDescriptor():VirtualDescriptor{return{label:'KIT',format:8,min:0,max:SLOOP_DRUM_KITS.length-1,defaultValue:SLOOP_DEFAULT_DRUM_KIT,unit:'',enumValues:[...SLOOP_DRUM_KITS]};}
 private descReply(command:SloopCommand,p:Uint8Array){const scope=(p[0]??0) as 0|1,id=p[1]??0;let descriptor:VirtualDescriptor|undefined;if(scope===1)descriptor=GLOBAL_DESCRIPTORS[id];else if(id<ENGINE_PARAMETER_START)descriptor=TRACK_COMMON[id];else if(this.selectedTrack===3&&id===ENGINE_PARAMETER_START)descriptor=this.drumKitDescriptor();else descriptor=engineDescriptors(this.engineName(this.selectedTrack))[id-ENGINE_PARAMETER_START];descriptor??={label:`${scope?'G':'P'}${id}`,format:0,min:0,max:0,defaultValue:0,unit:'',enumValues:[]};return frame(command,[scope,id,descriptor.format,...encodeV14(descriptor.min),...encodeV14(descriptor.max),...encodeV14(descriptor.defaultValue),...encodeCString(descriptor.label),...encodeCString(descriptor.unit),...descriptor.enumValues.flatMap(encodeCString)]);}
 private setReply(command:SloopCommand,p:Uint8Array){const scope=(p[0]??0) as 0|1,id=p[1]??0,descriptor=scope===1?GLOBAL_DESCRIPTORS[id]:this.descriptorForTrack(this.selectedTrack,id),raw=clamp(decodeRaw(p[2],p[3]),descriptor?.min??-8192,descriptor?.max??8191);if(scope===1){this.globals[id]=raw;if(id===G.BPM)Tone.Transport.bpm.value=raw;if(id===G.ENG&&this.selectedTrack<3)this.switchEngine(this.selectedTrack,raw);}else this.values[this.selectedTrack][id]=raw;this.syncTrack(this.selectedTrack);return frame(command,[scope,id,...encodeV14(raw)]);}
 private trackParamReply(command:SloopCommand,p:Uint8Array){const track=Math.min(3,p[0]??0),id=p[1]??0,descriptor=this.descriptorForTrack(track,id);if(p.length>=4)this.values[track][id]=clamp(decodeRaw(p[2],p[3]),descriptor?.min??-8192,descriptor?.max??8191);this.syncTrack(track);return frame(command,[track,id,...encodeV14(this.values[track][id]??0)]);}
 private trackStepReply(command:SloopCommand,p:Uint8Array){const track=Math.min(3,p[0]??0),index=Math.min(63,p[1]??0);if(p.length>2){const count=Math.min(4,p[2]??0);let offset=3;const notes=Array.from(p.slice(offset,offset+count));offset+=count;this.steps[track][index]={index,notes,time:p[offset++]??2,flags:p[offset++]??0,velocity:p[offset++]??100,level:(p[offset++]??100)|((p[offset++]??0)<<7),ratchet:p[offset++]??0};}const s=this.steps[track][index];return frame(command,[track,index,s.notes.length,...s.notes,s.time,s.flags,s.velocity,s.level&0x7f,(s.level>>7)&0x7f,s.ratchet]);}
 private drumStepReply(command:SloopCommand,p:Uint8Array){const index=Math.min(63,p[0]??0);if(p.length>=14)this.drums[index]={on:from7(p.slice(1,4)),levels:from7(p.slice(4,9)),ratchets:from7(p.slice(9,14))};const d=this.drums[index];return frame(command,[index,...to7(d.on,3),...to7(d.levels,5),...to7(d.ratchets,5)]);}
 private namesReply(command:SloopCommand,p:Uint8Array){const engine=clamp(p[0]??0,0,SLOOP_VIRTUAL_ENGINES.length-1),name=SLOOP_VIRTUAL_ENGINES[engine],names=SLOOP_FACTORY_PRESETS[name];return frame(command,[engine,names.length,...names.flatMap(encodeCString),...encodeCString('EDIT 1'),...encodeCString('EDIT 2')]);}
 private projectReply(command:SloopCommand,p:Uint8Array){const op=p[0]??2,slot=clamp(p[1]??0,0,3);if(op===1)this.projects[slot]=this.captureProject();else if(op===0&&this.projects[slot])this.restoreProject(this.projects[slot]!);return frame(command,[op,slot,this.projects[slot]?1:0,0]);}
 private userListReply(command:SloopCommand,p:Uint8Array){const start=clamp(p[0]??0,0,31),count=Math.min(p[1]??16,16,32-start),items:number[]=[];for(let i=0;i<count;i++){const u=this.user[start+i];items.push(u.used?1:0,u.engine,...encodeCString(u.used?u.name:'') );}return frame(command,[start,count,32,...items]);}
 private userStoreReply(command:SloopCommand,p:Uint8Array){const slot=clamp(p[0]??0,0,31),name=readCString(p,1).value||`VIRTUAL ${slot+1}`;this.user[slot]={used:true,engine:this.engines[this.selectedTrack]??0,preset:this.presets[this.selectedTrack]??0,name,values:[...this.values[this.selectedTrack]]};return frame(command,[slot,0]);}
 private userLoadReply(command:SloopCommand,p:Uint8Array){const slot=clamp(p[0]??0,0,31),u=this.user[slot];if(!u?.used)return frame(command,[slot,1]);this.engines[this.selectedTrack]=u.engine;this.presets[this.selectedTrack]=u.preset;this.values[this.selectedTrack]=[...u.values];this.syncTrack(this.selectedTrack);return frame(command,[slot,0]);}
 private userEraseReply(command:SloopCommand,p:Uint8Array){const slot=clamp(p[0]??0,0,31);this.user[slot]={used:false,engine:0,preset:0,name:'',values:this.defaultTrack(0)};return frame(command,[slot,0]);}
 private presetReply(command:SloopCommand,p:Uint8Array){const engine=clamp(p[0]??0,0,SLOOP_VIRTUAL_ENGINES.length-1),preset=clamp(p[1]??0,0,SLOOP_FACTORY_PRESETS[SLOOP_VIRTUAL_ENGINES[engine]].length-1);this.applyFactoryPatch(this.selectedTrack,engine,preset);this.syncTrack(this.selectedTrack);return frame(command,[engine,preset]);}

 private applyFactoryPatch(track:number,engine:number,preset:number){if(track>=3)return;const old=this.values[track],name=SLOOP_VIRTUAL_ENGINES[clamp(engine,0,SLOOP_VIRTUAL_ENGINES.length-1)],next=this.defaultTrack(engine),patch=factoryPatch(name,preset);next[IDX.LVL]=old?.[IDX.LVL]??next[IDX.LVL];next[IDX.PAN]=old?.[IDX.PAN]??next[IDX.PAN];next[IDX.MUTE]=old?.[IDX.MUTE]??next[IDX.MUTE];if(patch){next[IDX.ATK]=patch.adsr[0];next[IDX.DEC]=patch.adsr[1];next[IDX.SUS]=patch.adsr[2];next[IDX.REL]=patch.adsr[3];next[IDX.DST]=patch.fx[0];next[IDX.CHO]=patch.fx[1];next[IDX.DLY]=patch.fx[2];next[IDX.REV]=patch.fx[3];for(let i=0;i<8;i++)next[IDX.E0+i]=patch.engineParams[i]??next[IDX.E0+i];}this.engines[track]=engine;this.presets[track]=preset;this.values[track]=next;this.globals[G.ENG]=engine;}
 private switchEngine(track:number,engine:number){if(track>=3)return;this.engines[track]=clamp(engine,0,SLOOP_VIRTUAL_ENGINES.length-1);this.presets[track]=0;const old=this.values[track],next=this.defaultTrack(this.engines[track]);for(let i=0;i<ENGINE_PARAMETER_START;i++)next[i]=old[i]??next[i];this.values[track]=next;this.globals[G.ENG]=this.engines[track];}
 private descriptorForTrack(track:number,id:number){if(id<ENGINE_PARAMETER_START)return TRACK_COMMON[id];if(track===3&&id===ENGINE_PARAMETER_START)return this.drumKitDescriptor();if(track===3)return undefined;return engineDescriptors(this.engineName(track))[id-ENGINE_PARAMETER_START];}
 private defaultTrack(engine:number){return [...TRACK_COMMON.map(d=>d.defaultValue),...engineDescriptors(SLOOP_VIRTUAL_ENGINES[clamp(engine,0,SLOOP_VIRTUAL_ENGINES.length-1)]).map(d=>d.defaultValue)];}
 private trackEngine(track:number){return track===3?SLOOP_VIRTUAL_ENGINES.length:(this.engines[track]??0);}
 private engineName(track:number):SloopVirtualEngine{return SLOOP_VIRTUAL_ENGINES[this.engines[track]??0]??'ANALOG';}
 private syncAll(){for(let i=0;i<4;i++)this.syncTrack(i);Tone.Transport.bpm.value=this.globals[G.BPM]??90;}
 private syncTrack(track:number){const v=this.values[track];this.studio.configure(track,{engine:this.engineName(Math.min(track,2)),preset:this.presets[track]??0,level:v[IDX.LVL]??104,pan:v[IDX.PAN]??0,mute:!!v[IDX.MUTE],cutoff:v[IDX.E0+4]??v[IDX.ED_FLT]??64,resonance:v[IDX.E0+5]??0,attack:v[IDX.ATK],decay:v[IDX.DEC],sustain:v[IDX.SUS],release:v[IDX.REL],drive:v[IDX.DST],chorus:v[IDX.CHO],delay:v[IDX.DLY],reverb:v[IDX.REV],engineParams:v.slice(IDX.E0,IDX.E0+8)});}
 private captureProject():VirtualProject{return{engines:[...this.engines],presets:[...this.presets],values:this.values.map(v=>[...v]),globals:[...this.globals],steps:this.steps.map(track=>track.map(s=>({...s,notes:[...s.notes]}))),drums:this.drums.map(d=>({...d}))};}
 private restoreProject(project:VirtualProject){this.engines=[...project.engines];this.presets=[...project.presets];this.values=project.values.map(v=>[...v]);this.globals=[...project.globals];this.steps=project.steps.map(track=>track.map(s=>({...s,notes:[...s.notes]})));this.drums=project.drums.map(d=>({...d}));this.syncAll();}
}

function frame(command:SloopCommand,data:number[]):SloopFrame{return{command,data:Uint8Array.from(data.map(x=>x&0x7f))};}
function decodeRaw(lo=0,hi=64){return(lo|(hi<<7))-8192;}
function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v));}
function to7(value:number,count:number){return Array.from({length:count},(_,k)=>Math.floor(value/2**(7*k))&0x7f);}
function from7(bytes:Uint8Array){return Array.from(bytes).reduce((v,b,k)=>v+(b&0x7f)*2**(7*k),0);}
function midiToTone(note:number){const names=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];return`${names[note%12]}${Math.floor(note/12)-1}`;}
