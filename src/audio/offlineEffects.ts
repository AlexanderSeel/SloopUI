export interface OfflineEffectSettings {
  gainDb:number; dcRemove:boolean; lowpassHz:number; saturation:number; delayMs:number; delayFeedback:number; reverb:number; normalizePeak:boolean; normalizeRmsDb?:number; pitchSemitones:number; timeStretch:number;
}
export const DEFAULT_EFFECTS:OfflineEffectSettings={gainDb:0,dcRemove:false,lowpassHz:20000,saturation:0,delayMs:0,delayFeedback:0,reverb:0,normalizePeak:false,pitchSemitones:0,timeStretch:1};

export async function renderEffects(buffer:AudioBuffer,settings:OfflineEffectSettings):Promise<AudioBuffer>{
  let working=cloneAudioBuffer(buffer);
  if(settings.dcRemove)removeDc(working);
  if(settings.gainDb!==0)applyGain(working,10**(settings.gainDb/20));
  if(settings.pitchSemitones!==0||Math.abs(settings.timeStretch-1)>0.001)working=await resampleTransform(working,settings.pitchSemitones,settings.timeStretch);
  if(settings.lowpassHz<working.sampleRate/2-100)lowpass(working,settings.lowpassHz);
  if(settings.saturation>0)saturate(working,settings.saturation);
  if(settings.delayMs>1&&settings.delayFeedback>0)delay(working,settings.delayMs,settings.delayFeedback);
  if(settings.reverb>0)reverb(working,settings.reverb);
  if(settings.normalizeRmsDb!=null)normalizeRms(working,settings.normalizeRmsDb);
  if(settings.normalizePeak)normalizePeak(working);
  return working;
}

export function cloneAudioBuffer(buffer:AudioBuffer):AudioBuffer{const ctx=new OfflineAudioContext(buffer.numberOfChannels,buffer.length,buffer.sampleRate);const out=ctx.createBuffer(buffer.numberOfChannels,buffer.length,buffer.sampleRate);for(let c=0;c<buffer.numberOfChannels;c++)out.copyToChannel(buffer.getChannelData(c),c);return out;}
export function applyGain(buffer:AudioBuffer,gain:number){for(let c=0;c<buffer.numberOfChannels;c++){const d=buffer.getChannelData(c);for(let i=0;i<d.length;i++)d[i]*=gain;}}
export function removeDc(buffer:AudioBuffer){for(let c=0;c<buffer.numberOfChannels;c++){const d=buffer.getChannelData(c);let mean=0;for(const v of d)mean+=v;mean/=Math.max(1,d.length);for(let i=0;i<d.length;i++)d[i]-=mean;}}
export function normalizePeak(buffer:AudioBuffer,target=.98){let peak=1e-9;for(let c=0;c<buffer.numberOfChannels;c++)for(const v of buffer.getChannelData(c))peak=Math.max(peak,Math.abs(v));applyGain(buffer,target/peak);}
export function normalizeRms(buffer:AudioBuffer,targetDb=-14){let sum=0,n=0;for(let c=0;c<buffer.numberOfChannels;c++)for(const v of buffer.getChannelData(c)){sum+=v*v;n++;}const rms=Math.sqrt(sum/Math.max(1,n));if(rms>1e-9)applyGain(buffer,10**(targetDb/20)/rms);}
export function lowpass(buffer:AudioBuffer,hz:number){const x=Math.exp(-2*Math.PI*Math.max(20,hz)/buffer.sampleRate);for(let c=0;c<buffer.numberOfChannels;c++){const d=buffer.getChannelData(c);let y=0;for(let i=0;i<d.length;i++){y=(1-x)*d[i]+x*y;d[i]=y;}}}
export function saturate(buffer:AudioBuffer,amount:number){const drive=1+Math.max(0,amount)*12;const normalizer=Math.tanh(drive);for(let c=0;c<buffer.numberOfChannels;c++){const d=buffer.getChannelData(c);for(let i=0;i<d.length;i++)d[i]=Math.tanh(d[i]*drive)/normalizer;}}
export function delay(buffer:AudioBuffer,ms:number,feedback:number){const frames=Math.max(1,Math.round(buffer.sampleRate*ms/1000));const fb=Math.max(0,Math.min(.95,feedback));for(let c=0;c<buffer.numberOfChannels;c++){const d=buffer.getChannelData(c);for(let i=frames;i<d.length;i++)d[i]=Math.max(-1,Math.min(1,d[i]+d[i-frames]*fb));}}
export function reverb(buffer:AudioBuffer,amount:number){const mix=Math.max(0,Math.min(1,amount));for(const ms of [31,43,59,71]){const frames=Math.round(buffer.sampleRate*ms/1000);for(let c=0;c<buffer.numberOfChannels;c++){const d=buffer.getChannelData(c);for(let i=frames;i<d.length;i++)d[i]=Math.max(-1,Math.min(1,d[i]+d[i-frames]*mix*.18));}}}

async function resampleTransform(buffer:AudioBuffer,semitones:number,timeStretch:number):Promise<AudioBuffer>{
  const pitch=2**(semitones/12); const ratio=Math.max(.25,Math.min(4,timeStretch)); const outputLength=Math.max(1,Math.round(buffer.length*ratio/pitch));
  const ctx=new OfflineAudioContext(buffer.numberOfChannels,outputLength,buffer.sampleRate);const source=ctx.createBufferSource();source.buffer=buffer;source.playbackRate.value=pitch;source.connect(ctx.destination);source.start();const rendered=await ctx.startRendering();
  if(Math.abs(ratio-1)<.001)return rendered;
  const outCtx=new OfflineAudioContext(rendered.numberOfChannels,Math.max(1,Math.round(rendered.length*ratio)),rendered.sampleRate);const out=outCtx.createBuffer(rendered.numberOfChannels,Math.max(1,Math.round(rendered.length*ratio)),rendered.sampleRate);
  for(let c=0;c<rendered.numberOfChannels;c++){const src=rendered.getChannelData(c),dst=out.getChannelData(c);for(let i=0;i<dst.length;i++){const p=i/ratio,j=Math.floor(p),f=p-j;dst[i]=(src[Math.min(src.length-1,j)]??0)*(1-f)+(src[Math.min(src.length-1,j+1)]??0)*f;}}
  return out;
}
