import * as Tone from 'tone';

export type VirtualEngineKind='ANALOG'|'WAVETABLE'|'FM'|'SAMPLE'|'VOICE'|'TRIO'|'WHEEL'|'GRAIN'|'DIGITAL'|'PHASE'|'LOFI';
export interface VirtualTrackSettings{engine:VirtualEngineKind;level:number;pan:number;mute:boolean;cutoff?:number;resonance?:number;attack?:number;decay?:number;sustain?:number;release?:number;drive?:number;}

export class VirtualStudioEngine{
 private channels=Array.from({length:4},()=>new Tone.Channel().toDestination());
 private synths=[this.makeSynth(),this.makeSynth(),this.makeSynth()];
 private drum=new Tone.MembraneSynth().connect(this.channels[3]);
 private samples=new Map<number,Tone.Player>();
 constructor(){this.synths.forEach((s,i)=>s.connect(this.channels[i]));}
 private makeSynth(){return new Tone.PolySynth(Tone.Synth,{oscillator:{type:'sawtooth'},envelope:{attack:.01,decay:.2,sustain:.7,release:.6}});}
 async start(){await Tone.start();}
 dispose(){this.synths.forEach(s=>s.dispose());this.drum.dispose();this.samples.forEach(p=>p.dispose());this.channels.forEach(c=>c.dispose());}
 configure(track:number,settings:VirtualTrackSettings){const ch=this.channels[track];ch.volume.value=settings.mute?-Infinity:Tone.gainToDb(Math.max(.0001,settings.level/127));ch.pan.value=Math.max(-1,Math.min(1,settings.pan/64));if(track<3){const synth=this.synths[track];const osc=engineWave(settings.engine);synth.set({oscillator:{type:osc} as any,envelope:{attack:mapTime(settings.attack??8,.002,1.2),decay:mapTime(settings.decay??50,.02,2),sustain:Math.max(0,Math.min(1,(settings.sustain??90)/127)),release:mapTime(settings.release??50,.03,3)}});}}
 trigger(track:number,note:string,duration='16n',velocity=.8){if(track===3){this.drum.triggerAttackRelease(note,'32n',undefined,velocity);return;}this.synths[track]?.triggerAttackRelease(note,duration,undefined,velocity);}
 async setSample(lane:number,buffer:AudioBuffer){const old=this.samples.get(lane);old?.dispose();const player=new Tone.Player(buffer).connect(this.channels[3]);this.samples.set(lane,player);}
 triggerSample(lane:number){this.samples.get(lane)?.start();}
 async bounce(events:Array<{time:number;track:number;note:string;duration:number;velocity:number}>,seconds:number):Promise<AudioBuffer>{const rendered=await Tone.Offline(({transport})=>{const channels=Array.from({length:4},()=>new Tone.Channel().toDestination());const synths=[this.makeSynth(),this.makeSynth(),this.makeSynth()];synths.forEach((s,i)=>s.connect(channels[i]));const drum=new Tone.MembraneSynth().connect(channels[3]);for(const e of events){transport.scheduleOnce(()=>{if(e.track===3)drum.triggerAttackRelease(e.note,e.duration,undefined,e.velocity);else synths[e.track]?.triggerAttackRelease(e.note,e.duration,undefined,e.velocity);},e.time);}transport.start();},seconds);return rendered.get();}
}
function engineWave(engine:VirtualEngineKind):'sine'|'square'|'sawtooth'|'triangle'{if(engine==='FM'||engine==='PHASE')return'sine';if(engine==='DIGITAL'||engine==='WAVETABLE'||engine==='WHEEL')return'square';if(engine==='VOICE'||engine==='TRIO')return'triangle';return'sawtooth';}
function mapTime(v:number,min:number,max:number){return min+(Math.max(0,Math.min(127,v))/127)*(max-min);}
