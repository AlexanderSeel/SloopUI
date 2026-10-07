import * as Tone from 'tone';
import { virtualPresetProfile, type SloopVirtualEngine } from './virtualProfiles';

export interface VirtualTrackSettings{
  engine:SloopVirtualEngine; preset:number; level:number; pan:number; mute:boolean;
  cutoff?:number; resonance?:number; attack?:number; decay?:number; sustain?:number; release?:number;
  drive?:number; chorus?:number; delay?:number; reverb?:number; engineParams?:number[];
}
export interface VirtualBounceEvent{time:number;track:number;note:string;duration:number;velocity:number;engine?:SloopVirtualEngine;preset?:number;lane?:number;}
type TrackSampleSource={buffer:AudioBuffer;root:string};

export class VirtualStudioEngine{
 private lastAudioStart=0;
 private channels=Array.from({length:4},()=>new Tone.Channel().toDestination());
 private filters=Array.from({length:3},()=>new Tone.Filter(18000,'lowpass'));
 private crushers=Array.from({length:3},()=>new Tone.BitCrusher(12));
 private distortions=Array.from({length:3},()=>new Tone.Distortion(0));
 private choruses=Array.from({length:3},()=>new Tone.Chorus(3.5,2.5,.18).start());
 private tremolos=Array.from({length:3},()=>new Tone.Tremolo(5,.35).start());
 private delays=Array.from({length:3},()=>new Tone.FeedbackDelay('8n',.28));
 private reverbs=Array.from({length:3},()=>new Tone.Reverb({decay:1.8,wet:0}));
 private synths=[this.makeSynth(),this.makeSynth(),this.makeSynth()];
 private trackSamplers=new Map<number,Tone.Sampler>();
 private trackSampleSources=new Map<number,TrackSampleSource>();
 private drum=new Tone.MembraneSynth({pitchDecay:.035,octaves:6,envelope:{attack:.001,decay:.38,sustain:0,release:.08}}).connect(this.channels[3]);
 private drumTom=new Tone.MembraneSynth({pitchDecay:.015,octaves:2,envelope:{attack:.001,decay:.24,sustain:0,release:.05}}).connect(this.channels[3]);
 private drumNoiseShort=new Tone.NoiseSynth({noise:{type:'white'},envelope:{attack:.001,decay:.09,sustain:0,release:.02}}).connect(this.channels[3]);
 private drumNoiseLong=new Tone.NoiseSynth({noise:{type:'white'},envelope:{attack:.001,decay:.62,sustain:0,release:.05}}).connect(this.channels[3]);
 private drumMetal=new Tone.Synth({oscillator:{type:'square'},envelope:{attack:.001,decay:.12,sustain:0,release:.025}}).connect(this.channels[3]);
 private samples=new Map<number,Tone.Player>();
 private sampleSources=new Map<number,AudioBuffer>();
 constructor(){for(let i=0;i<3;i++)this.synths[i].chain(this.filters[i],this.crushers[i],this.distortions[i],this.choruses[i],this.tremolos[i],this.delays[i],this.reverbs[i],this.channels[i]);}
 private makeSynth(){return new Tone.PolySynth(Tone.Synth,{oscillator:{type:'sawtooth'},envelope:{attack:.01,decay:.2,sustain:.7,release:.6}});}
 async start(){await Tone.start();await Promise.all(this.reverbs.map(r=>r.generate().catch(()=>undefined)));}
 async resumeAudio(){await Tone.start();}
 private nextAudioStart(){const now=Tone.now();this.lastAudioStart=Math.max(now,this.lastAudioStart+.001);return this.lastAudioStart;}
 dispose(){this.synths.forEach(s=>s.dispose());this.trackSamplers.forEach(s=>s.dispose());this.trackSamplers.clear();this.filters.forEach(x=>x.dispose());this.crushers.forEach(x=>x.dispose());this.distortions.forEach(x=>x.dispose());this.choruses.forEach(x=>x.dispose());this.tremolos.forEach(x=>x.dispose());this.delays.forEach(x=>x.dispose());this.reverbs.forEach(x=>x.dispose());this.drum.dispose();this.drumTom.dispose();this.drumNoiseShort.dispose();this.drumNoiseLong.dispose();this.drumMetal.dispose();this.samples.forEach(p=>p.dispose());this.samples.clear();this.channels.forEach(c=>c.dispose());}
 configure(track:number,settings:VirtualTrackSettings){
  const ch=this.channels[track];if(!ch)return;
  ch.volume.value=settings.mute?-Infinity:Tone.gainToDb(Math.max(.0001,settings.level/127));
  ch.pan.value=Math.max(-1,Math.min(1,settings.pan/64));
  if(track>=3)return;
  const synth=this.synths[track],filter=this.filters[track],crusher=this.crushers[track],dist=this.distortions[track],chorus=this.choruses[track],tremolo=this.tremolos[track],delay=this.delays[track],reverb=this.reverbs[track];if(!synth||!filter||!crusher||!dist||!chorus||!tremolo||!delay||!reverb)return;
  const profile=virtualPresetProfile(settings.engine,settings.preset),character=engineCharacter(settings.engine,settings.engineParams??[],profile.wave,profile.detune);
  synth.set({oscillator:{type:character.wave} as any,detune:character.detune,envelope:{attack:blend(profile.attack,mapTime(settings.attack??8,.002,1.2),.5),decay:blend(profile.decay,mapTime(settings.decay??50,.02,2),.5),sustain:blend(profile.sustain,Math.max(0,Math.min(1,(settings.sustain??90)/127)),.5),release:blend(profile.release,mapTime(settings.release??50,.03,3),.5)}});
  const cut=character.cutoff??normalize127(settings.cutoff??127),res=character.resonance??normalize127(settings.resonance??0);
  filter.frequency.rampTo(70*Math.pow(260,cut),.03);filter.Q.rampTo(.4+res*15,.03);filter.type=character.filterType;
  (crusher.bits as any).value=character.bits;crusher.wet.value=character.crushWet;
  const drive=Math.max(normalize127(settings.drive??0),character.drive);dist.distortion=Math.min(.9,drive*.8);dist.wet.value=Math.min(.85,drive);
  const cho=Math.max(normalize127(settings.chorus??0),character.chorus);chorus.wet.value=cho*.7;chorus.depth=.05+cho*.8;
  tremolo.frequency.rampTo(character.tremoloRate,.03);tremolo.depth.value=character.tremoloDepth;tremolo.wet.value=character.tremoloDepth>0?Math.min(.7,character.tremoloDepth):0;
  delay.wet.value=normalize127(settings.delay??0)*.65;delay.feedback.value=.12+normalize127(settings.delay??0)*.55;
  reverb.wet.value=normalize127(settings.reverb??0)*.7;reverb.decay=.5+normalize127(settings.reverb??0)*5;
 }
 trigger(track:number,note:string,duration='16n',velocity=.8){const time=this.nextAudioStart();if(track===3){this.drum.triggerAttackRelease(note,'32n',time,velocity);return;}const sampler=this.trackSamplers.get(track);if(sampler)sampler.triggerAttackRelease(note,duration,time,velocity);else this.synths[track]?.triggerAttackRelease(note,duration,time,velocity);}
 async setTrackSample(track:number,buffer:AudioBuffer,root='C3'){if(track<0||track>2)throw new Error('Virtual sample instruments are available on synth tracks 1–3.');this.trackSamplers.get(track)?.dispose();const sampler=new Tone.Sampler({urls:{[root]:buffer}}).chain(this.filters[track],this.crushers[track],this.distortions[track],this.choruses[track],this.tremolos[track],this.delays[track],this.reverbs[track],this.channels[track]);await Tone.loaded();this.trackSamplers.set(track,sampler);this.trackSampleSources.set(track,{buffer,root});}
 clearTrackSample(track:number){this.trackSamplers.get(track)?.dispose();this.trackSamplers.delete(track);this.trackSampleSources.delete(track);}
 async setSample(lane:number,buffer:AudioBuffer){const old=this.samples.get(lane);old?.dispose();const player=new Tone.Player(buffer).connect(this.channels[3]);this.samples.set(lane,player);this.sampleSources.set(lane,buffer);}
 clearSample(lane:number){this.samples.get(lane)?.dispose();this.samples.delete(lane);this.sampleSources.delete(lane);}
 triggerSample(lane:number){const player=this.samples.get(lane);if(!player)return false;player.start(this.nextAudioStart());return true;}
 triggerDrumLane(lane:number,kit:number,velocity=.8){
  const c=drumKitCharacter(kit),v=Math.max(.04,Math.min(1,velocity*c.gain)),time=this.nextAudioStart();
  if(lane===0||lane===1){this.drum.triggerAttackRelease(lane===0?c.kick:'A0',lane===1?'4n':'8n',time,v);return;}
  if(lane===9||lane===10||lane===14){const note=lane===9?'G1':lane===10?'C2':'E2';this.drumTom.triggerAttackRelease(note,'16n',time,v*.88);return;}
  if(lane===4||lane===6){this.drumNoiseShort.triggerAttackRelease('32n',time,v*c.hat);return;}
  if(lane===5||lane===11||lane===12){this.drumNoiseLong.triggerAttackRelease(lane===5?'8n':'4n',time,v*c.metal);return;}
  if(lane===15){this.drumMetal.triggerAttackRelease(c.bell,'16n',time,v*.7);return;}
  if(lane===7){this.drumMetal.triggerAttackRelease('C6','32n',time,v*.6);return;}
  this.drumNoiseShort.triggerAttackRelease(lane===3?'16n':'32n',time,v*(lane===3?.9:.72));
 }
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

type Wave='sine'|'square'|'sawtooth'|'triangle';
function drumKitCharacter(kit:number){
 const k=Math.max(0,Math.min(36,kit));let gain=1,hat=.72,metal=.72,kick='C1',bell='A5';
 if(k===1){kick='A0';hat=.55;metal=.58;}else if(k===2){kick='D1';gain=1.08;hat=.82;}else if(k===3){kick='D1';hat=.95;metal=.95;}else if(k===4||k===13){gain=.82;hat=.55;metal=.52;}else if(k===5){kick='C1';gain=1.04;hat=.72;}else if(k===6||k===15||k===17){kick='D1';gain=1.12;hat=.9;metal=.92;}else if([10,11,14,22,23].includes(k)){kick='C1';gain=1.12;hat=.86;}else if([25,26,27,28].includes(k)){kick='B0';gain=1.03;hat=.72;}else if([30,31,32].includes(k)){gain=.85;hat=.62;bell='C6';}else if(k===35){gain=.65;hat=.45;metal=.55;}return{gain,hat,metal,kick,bell};
}
function engineCharacter(engine:SloopVirtualEngine,p:number[],fallbackWave:Wave,fallbackDetune:number){
 let wave=fallbackWave,detune=fallbackDetune,cutoff: number|undefined,resonance:number|undefined,drive=0,chorus=0,bits=16,crushWet=0,tremoloRate=5,tremoloDepth=0,filterType:'lowpass'|'bandpass'|'highpass'='lowpass';
 if(engine==='ANALOG'){wave=waveFromIndex(p[0],['sawtooth','square','triangle','sine','square']);detune=(p[1]??0)/4;cutoff=normalize127(p[4]??90);resonance=normalize127(p[5]??30);drive=normalize127(p[6]??0);}
 else if(engine==='DIGITAL'){wave='sine';detune=(p[4]??60)/16;drive=normalize127(p[6]??0)*.25;cutoff=.92;}
 else if(engine==='PHASE'){wave=waveFromIndex(p[0],['sawtooth','square','square','sawtooth','sine','triangle','square','sawtooth']);detune=(p[4]??0)/5;cutoff=.88;chorus=normalize127(p[6]??0)*.25;}
 else if(engine==='LOFI'){wave=waveFromIndex(p[1],['square','triangle','sawtooth','square','square']);cutoff=normalize127(p[7]??127);const chip=p[0]??0;bits=chip===2?1:chip===0?4:chip===1?8:6;bits=Math.max(1,Math.min(16,bits-Math.floor((p[3]??0)/42)));crushWet=.35+normalize127(p[3]??0)*.6;}
 else if(engine==='SAMPLE'){wave='sine';cutoff=normalize127(p[4]??127);drive=normalize127(p[6]??0);bits=Math.max(2,16-Math.floor((p[2]??0)/9));crushWet=(p[2]??0)>0?.72:0;}
 else if(engine==='VOICE'){wave='sawtooth';cutoff=.38+normalize127(p[4]??64)*.5;resonance=.15+normalize127(p[6]??64)*.65;chorus=.08;}
 else if(engine==='TRIO'){wave=waveFromIndex(p[0],['sawtooth','square','triangle','square','sawtooth','triangle','sawtooth','triangle']);detune=(p[3]??6)/2;cutoff=normalize127(p[5]??80);resonance=normalize127(p[6]??40);filterType=(p[4]??0)===1?'bandpass':(p[4]??0)===2?'highpass':'lowpass';chorus=.12;}
 else if(engine==='WHEEL'){wave='sine';drive=normalize127(p[6]??0);const rotor=p[7]??1;tremoloRate=rotor===2?6.2:rotor===1?1.1:.2;tremoloDepth=rotor===0?0:rotor===1?.25:.46;chorus=rotor===0?0:.16;cutoff=.94;}
 else if(engine==='GRAIN'){wave='triangle';cutoff=normalize127(p[7]??127);chorus=.12+normalize127(p[5]??30)*.2;detune=((p[6]??10)-10)/5;}
 return{wave,detune,cutoff,resonance,drive,chorus,bits,crushWet,tremoloRate,tremoloDepth,filterType};
}
function waveFromIndex(index:number|undefined,waves:Wave[]){return waves[Math.abs(index??0)%waves.length]??waves[0]??'sawtooth';}
function mapTime(v:number,min:number,max:number){return min+(Math.max(0,Math.min(127,v))/127)*(max-min);}function blend(a:number,b:number,t:number){return a*(1-t)+b*t;}function normalize127(v:number){return Math.max(0,Math.min(1,v/127));}
