import type { SessionState } from './SloopDeviceSession';

export interface DiagnosticEvent { at:number; kind:'midi-in'|'midi-out'|'state'|'error'|'info'; message:string; data?:number[]; }
const MAX=300; const events:DiagnosticEvent[]=[]; const listeners=new Set<(items:readonly DiagnosticEvent[])=>void>();
export function logDiagnostic(event:Omit<DiagnosticEvent,'at'>){events.push({...event,at:Date.now()});if(events.length>MAX)events.splice(0,events.length-MAX);listeners.forEach(l=>l(events));}
export function diagnosticsSnapshot(){return [...events];}
export function subscribeDiagnostics(listener:(items:readonly DiagnosticEvent[])=>void){listeners.add(listener);listener(events);return()=>listeners.delete(listener);}
export function clearDiagnostics(){events.length=0;listeners.forEach(l=>l(events));}
export function sessionDiagnosticSummary(state:SessionState){return{connected:state.connected,firmware:state.info?.firmware,protocol:state.info?.protocolVersion,track:state.selectedTrack,tracks:state.tracks.length,steps:state.steps.length,drumSteps:state.drumSteps.length,sampleSlots:state.sampleSlots.length,error:state.error};}
