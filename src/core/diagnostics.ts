import type { SessionState } from './SloopDeviceSession';

export interface DiagnosticEvent { at:number; kind:'midi-in'|'midi-out'|'state'|'error'|'info'; message:string; data?:number[]; }
const MAX=300; const events:DiagnosticEvent[]=[]; const listeners=new Set<(items:readonly DiagnosticEvent[])=>void>();
export function logDiagnostic(event:Omit<DiagnosticEvent,'at'>){events.push({...event,at:Date.now()});if(events.length>MAX)events.splice(0,events.length-MAX);listeners.forEach(l=>l([...events]));}
export function diagnosticsSnapshot(){return [...events];}
export function subscribeDiagnostics(listener:(items:readonly DiagnosticEvent[])=>void){listeners.add(listener);listener([...events]);return()=>listeners.delete(listener);}
export function clearDiagnostics(){events.length=0;listeners.forEach(l=>l([]));}
export function diagnosticsHealth(items:readonly DiagnosticEvent[]){const incoming=items.filter(e=>e.kind==='midi-in'),outgoing=items.filter(e=>e.kind==='midi-out'),errors=items.filter(e=>e.kind==='error'),last=items.at(-1);return{incoming:incoming.length,outgoing:outgoing.length,errors:errors.length,lastActivity:last?.at,lastInbound:incoming.at(-1)?.at,lastOutbound:outgoing.at(-1)?.at,trafficBalance:outgoing.length?incoming.length/outgoing.length:incoming.length?1:0};}
export function sessionDiagnosticSummary(state:SessionState){return{connected:state.connected,firmware:state.info?.firmware,protocol:state.info?.protocolVersion,track:state.selectedTrack,tracks:state.tracks.length,steps:state.steps.length,drumSteps:state.drumSteps.length,sampleSlots:state.sampleSlots.length,error:state.error};}
