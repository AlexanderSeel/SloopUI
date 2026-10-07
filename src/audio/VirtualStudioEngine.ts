import * as Tone from 'tone';
import { virtualPresetProfile, type SloopVirtualEngine } from './virtualProfiles';

export interface VirtualTrackSettings{
  engine:SloopVirtualEngine; preset:number; level:number; pan:number; mute:boolean;
  cutoff?:number; resonance?:number; attack?:number; decay?:number; sustain?:number; release?:number;
  drive?:number; chorus?:number; delay?:number; reverb?:number;
}
export interface VirtualBounceEvent{time:number;track:number;note:string;duration:number;velocity:number;engine?:SloopVirtualEngine;preset?:number;lane?:number;}
type TrackSampleSource={buffer:AudioBuffer;root:string};

export class VirtualStudioEngine{
 private channels=Array.from({length:4},()=>new Tone.Channel().toDestination());
 private filters=Array.from({length:3},()=>new Tone.Filter(18000,'lowpass'));
 private distortions=Array.from({length:3},()=>new Tone.Distortion(0));
 private choruses=Array.from({length:3},()=>new Tone.Chorus(3.5,2.5,.18).start());
 private delays=Array.from({length:3},()=>new Tone.FeedbackDelay('8n',.28));
 private reverbs=Array.from({length:3},()=>new Tone.Reverb({decay:1.8,wet:0}));
 private synths=[this.makeSynth(),this.makeSynth(),this.makeSynth()];
 private trackSamplers=new Map<number,Tone.Sampler>();
 private trackSampleSources=new Map<number,TrackSampleSource>();
 private drum=new Tone.MembraneSynth().connect(this.channels[3]);
 private samples=new Map<number,Tone.Player>();
 private sampleSources=new Map<number,AudioBuffer>();
 constructor(){for(let i=0;i<3;i++)this.synths[i].chain(this.filters[i],this.distortions[i],this.choruses[i],this.delays[i],this.reverbs[i],this.channels[i]);}
 private makeSynth(){return new Tone.PolySynth(Tone.Synth,{oscillator:{type:'sawtooth'},envelope:{attack:.01,decay:.2,sustain:.7,release:.6}});}
 async start(){await Tone.start();await Promise.all(this.reverbs.map(r=>r.generate().catch(()=>undefined)));}
 dispose(){this.synths.forEach(s=>s.dispose());this.trackSamplers.forEach(s=>s.dispose());this.trackSamplers.clear();this.filters.forEach(x=>x.dispose());this.distortions.forEach(x=>x.dispose());this.choruses.forEach(x=>x.dispose());this.delays.forEach(x=>x.dispose());this.reverbs.forEach(x=>x.dispose());this.drum.dispose();this.samples.forEach(p=>p.dispose());this.samples.clear();this.channels.forEach(c=>c.dispose());}
 configure(track:number,settings:VirtualTrackSettings){
  const ch=this.channels[track];if(!ch)return;
  ch.volume.value=settings.mute?-Infinity:Tone.gainToDb(Math.max(.0001,settings.level/127));
  ch.pan.value=Math.max(-1,Math.min(1,settings.pan/64));
  if(track>=3)return;
  const synth=this.synths[track],filter=this.filters[track],dist=this.distortions[track],chorus=this.choruses[track],delay=this.delays[track],reverb=this.reverbs[track];if(!synth||!filter||!dist||!chorus||!delay||!reverb)return;
  const profile=virtualPresetProfile(settings.engine,settings.preset);
  synth.set({oscillator:{type:profile.wave} as any,detune:profile.detune,envelope:{attack:blend(profile.attack,mapTime(settings.attack??8,.002,1.2),.5),decay:blend(profile.decay,mapTime(settings.decay??50,.02,2),.5),sustain:blend(profile.sustain,Math.max(0,Math.min(1,(settings.sustain??90)/127)),.5),release:blend(profile.release,mapTime(settings.release??50,.03,3),.5)}});
  const cut=normalize127(settings.cutoff??127),res=normalize127(settings.resonance??0);
  filter.frequency.rampTo(80*Math.pow(220,cut),.03);filter.Q.rampTo(.5+res*14,.03);
  dist.distortion=Math.min(.85,normalize127(settings.drive??0)*.75);dist.wet.value=Math.min(.8,normalize127(settings.drive??0));
  chorus.wet.value=normalize127(settings.chorus??0)*.7;chorus.depth=.05+normalize127(settings.chorus??0)*.75;
  delay.wet.value=normalize127(settings.delay??0)*.65;delay.feedback.value=.12+normalize127(settings.delay??0)*.55;
  reverb.wet.value=normalize127(settings.reverb??0)*.7;reverb.decay=.5+normalize127(settings.reverb??0)*5;
 }
 trigger(track:number,note:string,duration='16n',velocity=.8){if(track===3){this.drum.triggerAttackRelease(note,'32n',undefined,velocity);return;}const sampler=this.trackSamplers.get(track);if(sampler)sampler.triggerAttackRelease(note,duration,undefined,velocity);else this.synths[track]?.triggerAttackRelease(note,duration,undefined,velocity);}
 async setTrackSample(track:number,buffer:AudioBuffer,root='C3'){if(track<0||track>2)throw new Error('Virtual sample instruments are available on synth tracks 1–3.');this.trackSamplers.get(track)?.dispose();const sampler=new Tone.Sampler({urls:{[root]:buffer}}).chain(this.filters[track],this.distortions[track],this.choruses[track],this.delays[track],this.reverbs[track],this.channels[track]);await Tone.loaded();this.trackSamplers.set(track,sampler);this.trackSampleSources.set(track,{buffer,root});}
 clearTrackSample(track:number){this.trackSamplers.get(track)?.dispose();this.trackSamplers.delete(track);this.trackSampleSources.delete(track);}
 async setSample(lane:number,buffer:AudioBuffer){const old=this.samples.get(lane);old?.dispose();const player=new Tone.Player(buffer).connect(this.channels[3]);this.samples.set(lane,player);this.sampleSources.set(lane,buffer);}
 clearSample(lane:number){this.samples.get(lane)?.dispose();this.samples.delete(lane);this.sampleSources.delete(lane);}
 triggerSample(lane:number){this.samples.get(lane)?.start();}
 async bounce(events:VirtualBounceEvent[],seconds:number):Promise<AudioBuffer>{
  const trackSources=new Map(this.trackSampleSources),drumSources=new Map(this.sampleSources);
  const rendered=await Tone.Offline(({transport})=>{
   const channels=Array.from({length:4},()=>new Tone.Channel().toDestination());
   const synths=[this.makeSynth(),this.makeSynth(),this.makeSynth()];synths.forEach((s,i)=>s.connect(channels[i]));
   const samplers=new Map<number,Tone.Sampler>();for(const[track,source]of trackSources)samplers.set(track,new Tone.Sampler({urls:{[source.root]:source.buffer}}).connect(channels[track]));
   const drum=new Tone.MembraneSynth().connect(channels[3]);const players=new Map<number,Tone.Player>();for(const[lane,buffer]of drumSources)players.set(lane,new Tone.Player(buffer).connect(channels[3]));
   for(const e of events){if(e.track<3&&!samplers.has(e.track)){const profile=virtualPresetProfile(e.engine??'ANALOG',e.preset??0);synths[e.track]?.set({oscillator:{type:profile.wave} as any,detune:profile.detune,envelope:{attack:profile.attack,decay:profile.decay,sustain:profile.sustain,release:profile.release}});}transport.scheduleOnce(()=>{if(e.track===3){const player=e.lane==null?undefined:players.get(e.lane);if(player)player.start();else drum.triggerAttackRelease(e.note,e.duration,undefined,e.velocity);}else{const sampler=samplers.get(e.track);if(sampler)sampler.triggerAttackRelease(e.note,e.duration,undefined,e.velocity);else synths[e.track]?.triggerAttackRelease(e.note,e.duration,undefined,e.velocity);}},e.time);}
   transport.start();
  },seconds);
  const buffer=rendered.get();if(!buffer)throw new Error('Tone.js returned no offline render buffer.');return buffer;
 }
}
function mapTime(v:number,min:number,max:number){return min+(Math.max(0,Math.min(127,v))/127)*(max-min);}function blend(a:number,b:number,t:number){return a*(1-t)+b*t;}function normalize127(v:number){return Math.max(0,Math.min(1,v/127));}
