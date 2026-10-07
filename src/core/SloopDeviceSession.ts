import { decodeV14, encodeCString, encodeV14, pack7, readCString, SloopCommand, type SloopFrame } from '../protocol/sloopProtocol';
import type { BuiltFm1Sample } from '../audio/fm1Sample';
import type { SloopTransport } from './WebMidiSloopTransport';

export type ParamScope = 0 | 1;
export interface DeviceInfo { firmware:string; engineCount:number; parameterCount:number; globalCount:number; stepCount:number; engineParameterStart:number; engineNames:string[]; trackCount:number; protocolVersion:number; }
export interface ParameterDescriptor { scope:ParamScope; id:number; format:number; min:number; max:number; defaultValue:number; label:string; unit:string; enumValues:string[]; }
export interface TrackSummary { index:number; engine:number; preset:number; level:number; mute:boolean; armed:boolean; }
export interface StepData { index:number; notes:number[]; time:0|1|2; flags:number; velocity:number; level:number; ratchet:number; }
export interface DrumStepData { index:number; on:boolean[]; levels:number[]; ratchets:number[]; }
export interface SampleSlotInfo { index:number; zones:number; name:string; dataKiB:number; }
export interface UserPresetSummary { slot:number; used:boolean; engine:number; name:string; }
export interface ProjectSlot { slot:number; used:boolean; }
export interface SessionState {
  loading:boolean; connected:boolean; info?:DeviceInfo; selectedTrack:number; tracks:TrackSummary[]; descriptors:ParameterDescriptor[];
  values:Record<string,number>; steps:StepData[]; drumSteps:DrumStepData[]; sampleSlots:SampleSlotInfo[]; soloMask:number;
  error?:string;
}
const valueKey=(scope:ParamScope,id:number)=>`${scope}:${id}`;

export class SloopDeviceSession {
  private listeners=new Set<(state:SessionState)=>void>(); private unsubscribe?:()=>void;
  private state:SessionState={loading:false,connected:false,selectedTrack:0,tracks:[],descriptors:[],values:{},steps:[],drumSteps:[],sampleSlots:[],soloMask:0};
  constructor(public readonly transport:SloopTransport){}
  snapshot(){return this.state;}
  subscribe(listener:(state:SessionState)=>void){this.listeners.add(listener);return()=>{this.listeners.delete(listener);};}
  request(command:SloopCommand,data:Iterable<number>=[],timeoutMs?:number){return this.transport.request(command,data,timeoutMs);}

  async connect(){
    this.patch({loading:true,error:undefined});
    try{
      await this.transport.connect(); this.unsubscribe=this.transport.subscribe(frame=>void this.onPush(frame));
      const info=await this.loadInfo(); this.patch({info}); const trackState=await this.loadTracks(); this.patch({...trackState,connected:true});
      await this.loadDescriptors(); await Promise.all([this.loadSelectedTrack(),this.loadSamples()]); this.patch({loading:false});
    }catch(error){await this.transport.disconnect().catch(()=>undefined);this.patch({loading:false,connected:false,error:error instanceof Error?error.message:'Connection failed'});throw error;}
  }
  async disconnect(){this.unsubscribe?.();this.unsubscribe=undefined;await this.transport.disconnect();this.patch({connected:false,loading:false});}
  async refreshAll(){const tracks=await this.loadTracks();this.patch(tracks);await this.loadDescriptors();await Promise.all([this.loadSelectedTrack(),this.loadSamples()]);}
  async selectTrack(track:number){const reply=await this.transport.request(SloopCommand.Track,[track]);this.patch({selectedTrack:reply.data[0]??track});await Promise.all([this.loadDescriptors(),this.loadSelectedTrack()]);}

  async setParameter(scope:ParamScope,id:number,value:number){
    const descriptor=this.state.descriptors.find(item=>item.scope===scope&&item.id===id); const [lo,hi]=encodeV14(value);
    const reply=await this.transport.request(SloopCommand.Set,[scope,id,lo,hi]); const actual=decodeV14(reply.data[2]??lo,reply.data[3]??hi);
    this.patch({values:{...this.state.values,[valueKey(scope,id)]:actual}});
    if(scope===1&&descriptor?.label.toUpperCase()==='ENG'){const tracks=await this.loadTracks();this.patch(tracks);await this.loadDescriptors();await this.loadSelectedTrack();}
    return actual;
  }
  async setTrackParameter(track:number,id:number,value:number){const [lo,hi]=encodeV14(value);const r=await this.transport.request(SloopCommand.TrackParam,[track,id,lo,hi]);const actual=decodeV14(r.data[2]??lo,r.data[3]??hi);if(track===this.state.selectedTrack)this.patch({values:{...this.state.values,[valueKey(0,id)]:actual}});return actual;}
  async setTrackMix(track:number,level:number,mute:boolean){const [lo,hi]=encodeV14(level);const r=await this.transport.request(SloopCommand.TrackMix,[track,lo,hi,mute?1:0]);const actual=decodeV14(r.data[1]??lo,r.data[2]??hi);this.patch({tracks:this.state.tracks.map(t=>t.index===track?{...t,level:actual,mute:!!r.data[3]}:t)});return actual;}
  async setTrackPan(track:number,value:number){const pan=this.state.descriptors.find(d=>d.scope===0&&d.label.toUpperCase()==='PAN');if(!pan)throw new Error('PAN parameter is unavailable.');return this.setTrackParameter(track,pan.id,value);}

  async setStep(step:StepData){const track=this.state.selectedTrack;const data=[track,step.index,step.notes.length,...step.notes.slice(0,4),step.time,step.flags,step.velocity,step.level&0x7f,(step.level>>7)&0x7f,step.ratchet];const r=await this.transport.request(SloopCommand.TrackStep,data);const parsed=this.parseTrackStep(r.data.slice(1));this.patch({steps:upsertByIndex(this.state.steps,parsed)});}
  async toggleStep(index:number,note=60){const current=this.state.steps.find(x=>x.index===index)??{index,notes:[],time:2 as const,flags:0,velocity:100,level:100,ratchet:0};await this.setStep(current.notes.length?{...current,notes:[],time:2}:{...current,notes:[note],time:0,velocity:current.velocity||100,level:current.level||100});}
  async applySteps(steps:StepData[],progress?:(done:number,total:number)=>void){for(let i=0;i<steps.length;i++){await this.setStep(steps[i]);progress?.(i+1,steps.length);}}
  async setDrumStep(step:DrumStepData){const onMask=step.on.reduce((m,on,i)=>on?m+2**i:m,0);const levelMask=step.levels.reduce((m,v,i)=>step.on[i]?m+((v|0)&3)*4**i:m,0);const ratchetMask=step.ratchets.reduce((m,v,i)=>step.on[i]?m+((v|0)&3)*4**i:m,0);const r=await this.transport.request(SloopCommand.DrumStep,[step.index,...to7BitBytes(onMask,3),...to7BitBytes(levelMask,5),...to7BitBytes(ratchetMask,5)]);this.patch({drumSteps:upsertByIndex(this.state.drumSteps,this.parseDrumStep(r.data))});}
  async setDrumLane(stepIndex:number,lane:number,enabled:boolean,level?:number,ratchet?:number){const current=this.state.drumSteps.find(x=>x.index===stepIndex)??{index:stepIndex,on:Array(16).fill(false),levels:Array(16).fill(2),ratchets:Array(16).fill(0)};const next={...current,on:[...current.on],levels:[...current.levels],ratchets:[...current.ratchets]};next.on[lane]=enabled;if(level!=null)next.levels[lane]=level;if(ratchet!=null)next.ratchets[lane]=ratchet;await this.setDrumStep(next);}
  async applyDrumSteps(steps:DrumStepData[],progress?:(done:number,total:number)=>void){for(let i=0;i<steps.length;i++){await this.setDrumStep(steps[i]);progress?.(i+1,steps.length);}}
  async refreshSequence(){const info=this.state.info;if(!info)return;if(this.state.selectedTrack===3){const drumSteps:DrumStepData[]=[];for(let i=0;i<info.stepCount;i++)drumSteps.push(this.parseDrumStep((await this.transport.request(SloopCommand.DrumStep,[i])).data));this.patch({drumSteps});}else{const steps:StepData[]=[];for(let i=0;i<info.stepCount;i++){const r=await this.transport.request(SloopCommand.TrackStep,[this.state.selectedTrack,i]);steps.push(this.parseTrackStep(r.data.slice(1)));}this.patch({steps});}}

  async project(op:0|1|2,slot:number):Promise<ProjectSlot>{const r=await this.transport.request(SloopCommand.Project,[op,slot],op===1?3500:1500);if((r.data[3]??0)===1)throw new Error('Stop playback before loading/saving a project.');if(op===0)await this.refreshAll();return{slot,used:!!r.data[2]};}
  async queryProjects(){const out:ProjectSlot[]=[];for(let slot=0;slot<4;slot++)out.push(await this.project(2,slot));return out;}
  async applyFactoryPreset(engine:number,preset:number){await this.transport.request(SloopCommand.Preset,[engine,preset]);await this.refreshAll();}

  async listUserPresets():Promise<UserPresetSummary[]>{const output:UserPresetSummary[]=[];for(const start of [0,16]){const r=await this.transport.request(SloopCommand.UserPresetList,[start,16]);let offset=3;const count=r.data[1]??0;for(let i=0;i<count;i++){const used=!!r.data[offset++],engine=r.data[offset++]??0,name=readCString(r.data,offset);offset=name.next;output.push({slot:start+i,used,engine,name:name.value});}}return output;}
  async storeUserPreset(slot:number,name=''){const r=await this.transport.request(SloopCommand.UserPresetStore,[slot,...encodeCString(sanitizePresetName(name))],2200);const rc=r.data[1]??0;if(rc)throw new Error(`User preset store failed (rc ${rc}).`);}
  async loadUserPreset(slot:number){const r=await this.transport.request(SloopCommand.UserPresetLoad,[slot],1800);const rc=r.data[1]??0;if(rc)throw new Error(`User preset load failed (rc ${rc}).`);await this.refreshAll();}
  async eraseUserPreset(slot:number){const r=await this.transport.request(SloopCommand.UserPresetErase,[slot],1800);const rc=r.data[1]??0;if(rc)throw new Error(`User preset erase failed (rc ${rc}).`);}

  async loadSamples(){try{const r=await this.transport.request(SloopCommand.SampleInfo);let offset=0;const slots=r.data[offset++]??0;offset++;const sampleSlots:SampleSlotInfo[]=[];for(let i=0;i<slots;i++){const zones=r.data[offset++]??0;const name=readCString(r.data,offset);offset=name.next;const dataKiB=r.data[offset++]??0;sampleSlots.push({index:i,zones,name:name.value,dataKiB});}this.patch({sampleSlots});}catch{/* optional */}}
  async eraseSample(slot:number){const r=await this.transport.request(SloopCommand.SampleErase,[slot],2500);const rc=r.data[1]??0;if(rc)throw new Error(`Sample erase failed (rc ${rc}).`);await this.loadSamples();}
  async uploadSample(slot:number,sample:BuiltFm1Sample,progress?:(done:number,total:number)=>void){
    let r=await this.transport.request(SloopCommand.SampleBegin,[slot],1800);let rc=r.data[1]??0;if(rc)throw sampleError('begin',rc);
    const total=sample.data.length;for(let off=0;off<sample.data.length;off+=256){const chunk=sample.data.slice(off,off+256);const address=512+off;r=await this.transport.request(SloopCommand.SampleWrite,[slot,address&0x7f,(address>>7)&0x7f,(address>>14)&0x7f,...pack7(chunk)],1800);rc=r.data[4]??r.data[3]??0;if(rc)throw sampleError('write',rc);progress?.(Math.min(total,off+chunk.length),total);}
    r=await this.transport.request(SloopCommand.SampleEnd,[slot,...pack7(sample.header)],3000);rc=r.data[1]??0;if(rc)throw sampleError('commit',rc);await this.loadSamples();
  }

  private async loadInfo(){const data=(await this.transport.request(SloopCommand.Info)).data;let offset=0;const version=readCString(data,offset);offset=version.next;const engineCount=data[offset++]??0,parameterCount=data[offset++]??0,globalCount=data[offset++]??0,stepCount=data[offset++]??16,engineParameterStart=data[offset++]??Math.max(0,parameterCount-8);const engineNames:string[]=[];for(let i=0;i<engineCount;i++){const s=readCString(data,offset);engineNames.push(s.value);offset=s.next;}const trackCount=data[offset++]??1,protocolVersion=data[offset++]??(trackCount>=4?3:1);return{firmware:version.value,engineCount,parameterCount,globalCount,stepCount,engineParameterStart,engineNames,trackCount,protocolVersion};}
  private async loadTracks():Promise<Pick<SessionState,'selectedTrack'|'tracks'|'soloMask'>>{const data=(await this.transport.request(SloopCommand.Track)).data;let offset=0;const selectedTrack=data[offset++]??0,count=data[offset++]??1;const tracks:TrackSummary[]=[];for(let index=0;index<count;index++){const engine=data[offset++]??0,preset=data[offset++]??0,level=decodeV14(data[offset++]??0,data[offset++]??64),mute=!!data[offset++],armed=!!data[offset++];tracks.push({index,engine,preset,level,mute,armed});}const soloMask=data[offset++]??0;return{selectedTrack,tracks,soloMask};}
  private async loadDescriptors(){const info=this.state.info;if(!info)return;const descriptors:ParameterDescriptor[]=[];for(const scope of [0,1] as const){const count=scope===0?info.parameterCount:info.globalCount;for(let id=0;id<count;id++){const data=(await this.transport.request(SloopCommand.Desc,[scope,id])).data;let offset=2;const format=data[offset++]??0,min=decodeV14(data[offset++]??0,data[offset++]??64),max=decodeV14(data[offset++]??0,data[offset++]??64),defaultValue=decodeV14(data[offset++]??0,data[offset++]??64);const label=readCString(data,offset);offset=label.next;const unit=readCString(data,offset);offset=unit.next;const enumValues:string[]=[];if(format===8)for(let value=min;value<=max&&offset<data.length&&enumValues.length<64;value++){const option=readCString(data,offset);enumValues.push(option.value);offset=option.next;}descriptors.push({scope,id,format,min,max,defaultValue,label:label.value||`${scope?'G':'P'}${id}`,unit:unit.value,enumValues});}}this.patch({descriptors});}
  private async loadSelectedTrack(){const info=this.state.info;if(!info)return;const dump=(await this.transport.request(SloopCommand.Dump)).data;let offset=2;const values={...this.state.values};for(let id=0;id<info.parameterCount;id++)values[valueKey(0,id)]=decodeV14(dump[offset++]??0,dump[offset++]??64);for(let id=0;id<info.globalCount;id++)values[valueKey(1,id)]=decodeV14(dump[offset++]??0,dump[offset++]??64);this.patch({values});await this.refreshSequence();}
  private parseTrackStep(data:Uint8Array):StepData{let offset=0;const index=data[offset++]??0,count=data[offset++]??0,notes=Array.from(data.slice(offset,offset+count));offset+=count;const time=(data[offset++]??2) as 0|1|2,flags=data[offset++]??0,velocity=data[offset++]??0,level=(data[offset++]??velocity)|((data[offset++]??0)<<7),ratchet=data[offset++]??0;return{index,notes,time,flags,velocity,level,ratchet};}
  private parseDrumStep(data:Uint8Array):DrumStepData{const index=data[0]??0,onMask=from7BitBytes(data.slice(1,4)),levelMask=from7BitBytes(data.slice(4,9)),ratchetMask=from7BitBytes(data.slice(9,14));return{index,on:Array.from({length:16},(_,lane)=>!!((onMask>>lane)&1)),levels:Array.from({length:16},(_,lane)=>Math.floor(levelMask/4**lane)&3),ratchets:Array.from({length:16},(_,lane)=>Math.floor(ratchetMask/4**lane)&3)};}
  private async onPush(frame:SloopFrame){if(frame.command===SloopCommand.Changed&&frame.data.length>=4){const scope=frame.data[0] as ParamScope,id=frame.data[1],value=decodeV14(frame.data[2],frame.data[3]);this.patch({values:{...this.state.values,[valueKey(scope,id)]:value}});}else if(frame.command===SloopCommand.TrackChanged&&frame.data.length>=4){const[track,id,lo,hi]=frame.data,value=decodeV14(lo,hi);const pan=this.state.descriptors.find(d=>d.scope===0&&d.label.toUpperCase()==='PAN')?.id,mute=this.state.descriptors.find(d=>d.scope===0&&d.label.toUpperCase()==='MUTE')?.id;this.patch({tracks:this.state.tracks.map(t=>t.index===track?{...t,...(id===0?{level:value}:{}),...(id===mute?{mute:!!value}:{}),...(id===pan?{}:{})}:t)});}else if(frame.command===SloopCommand.Reload){await this.refreshAll();}else if(frame.command===SloopCommand.StepChanged){await this.refreshSequence();}}
  private patch(patch:Partial<SessionState>){this.state={...this.state,...patch};this.listeners.forEach(listener=>listener(this.state));}
}

function upsertByIndex<T extends{index:number}>(items:T[],value:T){return items.some(x=>x.index===value.index)?items.map(x=>x.index===value.index?value:x):[...items,value];}
function to7BitBytes(value:number,count:number){return Array.from({length:count},(_,k)=>Math.floor(value/2**(7*k))&0x7f);}
function from7BitBytes(bytes:Uint8Array){return Array.from(bytes).reduce((value,byte,k)=>value+(byte&0x7f)*2**(7*k),0);}
function sanitizePresetName(name:string){return name.replace(/[^\x20-\x7e]/g,'').slice(0,12);}
function sampleError(stage:string,rc:number){const labels:Record<number,string>={1:'arguments/size',2:'erase/header',3:'write/CRC',4:'flash/slot in use',5:'zones'};return new Error(`Sample ${stage} failed: ${labels[rc]??`rc ${rc}`}.`);}
