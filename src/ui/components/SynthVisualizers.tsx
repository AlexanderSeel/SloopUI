import type { ParameterDescriptor, SessionState } from '../../core/SloopDeviceSession';

const W=260,H=92;
export type SynthVisualKind='filter'|'adsr'|'lfo';
export function SynthVisualizer({state,kind}:{state:SessionState;kind:SynthVisualKind}){if(kind==='adsr')return <AdsrScope state={state}/>;if(kind==='lfo')return <LfoScope state={state}/>;return <FilterScope state={state}/>;}

function LfoScope({state}:{state:SessionState}){
 const rate=descriptorById(state,9),wave=descriptorById(state,10),phase=descriptorById(state,11),fade=descriptorById(state,12);
 if(!rate&&!wave)return null;const waveValue=wave?raw(state,wave)-wave.min:0;
 return <Scope title="LFO" hint={`${wave?.enumValues?.[Math.max(0,waveValue)]??'WAVE'} · ${rate?displayRaw(state,rate):''}`}><LfoGraph rate={normal(state,rate)} wave={waveValue} phase={normal(state,phase)} fade={normal(state,fade)}/></Scope>;
}
function FilterScope({state}:{state:SessionState}){
 const engineStart=state.info?.engineParameterStart??50;
 const cutoff=findEngineDescriptor(state,engineStart,['CUT','CUTOFF','TONE']);
 const resonance=findEngineDescriptor(state,engineStart,['RES','RESO','RESONANCE','Q']);
 const envAmount=descriptorById(state,5);
 const c=cutoff?normal(state,cutoff):.68,r=resonance?normal(state,resonance):0,env=envAmount?bipolar(state,envAmount):0;
 return <Scope title="FILTER" hint={`${cutoff?displayRaw(state,cutoff):'engine'} · env ${signedPercent(env)}`}><FilterGraph cutoff={c} resonance={r} env={env}/></Scope>;
}
function AdsrScope({state}:{state:SessionState}){
 const attack=descriptorById(state,1),decay=descriptorById(state,2),sustain=descriptorById(state,3),release=descriptorById(state,4);
 if(!attack&&!decay&&!sustain&&!release)return null;
 return <Scope title="AMP ENVELOPE" hint={`A ${pct(normal(state,attack))} · D ${pct(normal(state,decay))} · S ${pct(normal(state,sustain))} · R ${pct(normal(state,release))}`}><AdsrGraph attack={normal(state,attack)} decay={normal(state,decay)} sustain={normal(state,sustain)} release={normal(state,release)}/></Scope>;
}
function Scope({title,hint,children}:{title:string;hint:string;children:React.ReactNode}){const id=`grid-${title.replace(/\W/g,'')}`;return <section className="synth-scope"><div className="synth-scope-head"><b>{title}</b><span>{hint}</span></div><div className="synth-scope-screen"><svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-label={`${title} visualization`}><defs><pattern id={id} width="26" height="23" patternUnits="userSpaceOnUse"><path d="M 26 0 L 0 0 0 23" fill="none" stroke="currentColor" strokeOpacity=".09" strokeWidth="1"/></pattern></defs><rect width={W} height={H} fill={`url(#${id})`}/>{children}</svg></div></section>}
function LfoGraph({rate,wave,phase,fade}:{rate:number;wave:number;phase:number;fade:number}){const cycles=.8+rate*4.2,pts:string[]=[];for(let x=0;x<=W;x+=2){const t=x/W,p=t*cycles+phase,angle=p*Math.PI*2;let y=0;if(wave===1)y=2/Math.PI*Math.asin(Math.sin(angle));else if(wave===2)y=2*(p-Math.floor(p)) - 1;else if(wave===3)y=Math.sin(angle)>=0?1:-1;else if(wave===4)y=Math.sin((Math.floor(p*8)+13)*19.73);else y=Math.sin(angle);const amp=fade<=.01?1:Math.min(1,t/Math.max(.02,fade*.8));pts.push(`${x},${H/2-y*(H*.34)*amp}`);}return <><line x1="0" y1={H/2} x2={W} y2={H/2} className="scope-axis"/><polyline points={pts.join(' ')} className="scope-line"/></>}
function FilterGraph({cutoff,resonance,env}:{cutoff:number;resonance:number;env:number}){const fc=.07+.86*Math.max(0,Math.min(1,cutoff+env*.12)),pts:string[]=[];for(let x=0;x<=W;x+=2){const f=x/W,q=1.1+resonance*10,d=Math.max(.008,Math.abs(f-fc)),lp=1/(1+Math.pow(f/Math.max(.02,fc),9)),peak=Math.exp(-d*q*13)*resonance*.5,amp=Math.min(1,lp+peak);pts.push(`${x},${H-9-amp*(H-20)}`);}return <><line x1="0" y1={H-9} x2={W} y2={H-9} className="scope-axis"/><polyline points={pts.join(' ')} className="scope-line"/><line x1={fc*W} y1="7" x2={fc*W} y2={H-9} className="scope-marker"/></>}
function AdsrGraph({attack,decay,sustain,release}:{attack:number;decay:number;sustain:number;release:number}){const a=10+attack*58,d=12+decay*52,r=12+release*58,s=.04+.94*sustain,total=a+d+54+r,scale=(W-14)/total,x0=7,x1=x0+a*scale,x2=x1+d*scale,x3=x2+54*scale,x4=W-7,y0=H-8,yPeak=9,ySus=y0-(y0-yPeak)*s;return <><line x1="5" y1={y0} x2={W-5} y2={y0} className="scope-axis"/><polyline points={`${x0},${y0} ${x1},${yPeak} ${x2},${ySus} ${x3},${ySus} ${x4},${y0}`} className="scope-line"/><circle cx={x1} cy={yPeak} r="2.4" className="scope-node"/><circle cx={x2} cy={ySus} r="2.4" className="scope-node"/><circle cx={x3} cy={ySus} r="2.4" className="scope-node"/></>}

function descriptorById(state:SessionState,id:number){return state.descriptors.find(d=>d.scope===0&&d.id===id);}
function findEngineDescriptor(state:SessionState,start:number,labels:string[]){const set=new Set(labels);return state.descriptors.find(d=>d.scope===0&&d.id>=start&&set.has(d.label.toUpperCase()));}
function raw(state:SessionState,d:ParameterDescriptor){return state.values[`0:${d.id}`]??d.defaultValue;}
function normal(state:SessionState,d?:ParameterDescriptor){if(!d||d.max===d.min)return 0;return Math.max(0,Math.min(1,(raw(state,d)-d.min)/(d.max-d.min)));}
function bipolar(state:SessionState,d:ParameterDescriptor){const value=raw(state,d);return Math.max(-1,Math.min(1,value<0?value/Math.max(1,-d.min):value/Math.max(1,d.max)));}
function pct(v:number){return `${Math.round(v*100)}%`;}
function signedPercent(v:number){return `${v>0?'+':''}${Math.round(v*100)}%`;}
function displayRaw(state:SessionState,d:ParameterDescriptor){const value=raw(state,d);if(d.format===8&&d.enumValues[value-d.min])return d.enumValues[value-d.min];return `${value}${d.unit?` ${d.unit}`:''}`;}
