import { Download } from 'lucide-react';
import { useState } from 'react';
import type { SessionState } from '../../core/SloopDeviceSession';
import type { VirtualSloopTransport } from '../../core/VirtualSloopTransport';
import { bounceCurrentPattern } from '../../audio/offlineBounce';
import { audioBufferToWav } from '../../audio/audioWav';

export function VirtualBouncePanel({state,transport,bpm}:{state:SessionState;transport:VirtualSloopTransport;bpm:number}){const[status,setStatus]=useState('');async function bounce(){setStatus('Rendering…');try{const buffer=await bounceCurrentPattern(transport,state,bpm);const wav=audioBufferToWav(buffer);const url=URL.createObjectURL(new Blob([wav],{type:'audio/wav'}));const a=document.createElement('a');a.href=url;a.download='sloopui-bounce.wav';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus(`Rendered ${buffer.duration.toFixed(2)} s`);}catch(e){setStatus(e instanceof Error?e.message:'Bounce failed');}}return <section className="hardware-panel rounded-xl p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><b>Virtual Bounce</b><div className="text-xs text-zinc-500">offline render of the current virtual pattern</div></div><div className="flex items-center gap-2"><span className="text-[10px] text-zinc-500">{status}</span><button onClick={()=>void bounce()} className="rounded bg-violet-300 px-3 py-2 text-xs font-black text-black"><Download size={13} className="mr-1 inline"/>BOUNCE WAV</button></div></div></section>;}
