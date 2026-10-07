import { afterEach, describe, expect, it } from 'vitest';
import { WebMidiSloopTransport } from './WebMidiSloopTransport';
import { encodeFrame, SloopCommand } from '../protocol/sloopProtocol';

describe('WebMidiSloopTransport mocked browser boundary',()=>{
 afterEach(()=>{Reflect.deleteProperty(globalThis,'window');Reflect.deleteProperty(globalThis,'navigator');});
 it('requests SysEx permission, pairs ports, handshakes and exchanges frames',async()=>{
  Object.defineProperty(globalThis,'window',{value:globalThis,configurable:true});
  let inputHandler:((event:{data:Uint8Array})=>void)|null=null;let requestedSysex=false;const sent:Uint8Array[]=[];
  const input={id:'fm-in',name:'M-VAVE FM-1',manufacturer:'M-VAVE',state:'connected',type:'input',open:async()=>input,close:async()=>input,set onmidimessage(value:any){inputHandler=value;},get onmidimessage(){return inputHandler;}} as any;
  const output={id:'fm-out',name:'M-VAVE FM-1',manufacturer:'M-VAVE',state:'connected',type:'output',open:async()=>output,close:async()=>output,send:(bytes:Uint8Array)=>{sent.push(Uint8Array.from(bytes));const command=bytes[4] as SloopCommand;queueMicrotask(()=>inputHandler?.({data:encodeFrame(command,[0])}));}} as any;
  const access={inputs:new Map([[input.id,input]]),outputs:new Map([[output.id,output]]),onstatechange:null} as any;
  Object.defineProperty(globalThis,'navigator',{value:{requestMIDIAccess:async(options:{sysex?:boolean})=>{requestedSysex=!!options.sysex;return access;}},configurable:true});
  const ports=await WebMidiSloopTransport.listPorts();expect(requestedSysex).toBe(true);expect(ports.map(p=>p.id)).toEqual(['fm-in','fm-out']);
  const transport=new WebMidiSloopTransport();await transport.connect();expect(transport.state).toBe('connected');expect(sent.some(frame=>frame[4]===SloopCommand.Info)).toBe(true);expect(sent.some(frame=>frame[4]===SloopCommand.Watch)).toBe(true);
  const ping=await transport.request(SloopCommand.Ping);expect(ping.command).toBe(SloopCommand.Ping);await transport.disconnect();expect(transport.state).toBe('idle');
 });
});
