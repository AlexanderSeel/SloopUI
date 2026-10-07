import { describe, expect, it } from 'vitest';
import { SloopDeviceSession } from './SloopDeviceSession';
import type { ConnectionState, SloopTransport } from './WebMidiSloopTransport';
import { encodeCString, encodeV14, SloopCommand, type SloopFrame } from '../protocol/sloopProtocol';

class MockTransport implements SloopTransport{
 state:ConnectionState='idle';private listeners=new Set<(frame:SloopFrame)=>void>();private level=100;
 async connect(){this.state='connected';}async disconnect(){this.state='idle';}
 async request(command:SloopCommand,data:Iterable<number>=[]):Promise<SloopFrame>{const p=[...data];if(command===SloopCommand.Info)return f(command,[...encodeCString('MOCK 1.0'),1,1,1,4,0,...encodeCString('ANALOG'),4,5]);if(command===SloopCommand.Track)return f(command,[0,4,0,0,...encodeV14(100),0,0,0,0,...encodeV14(100),0,0,0,0,...encodeV14(100),0,0,4,0,...encodeV14(100),0,0,0]);if(command===SloopCommand.Desc){const scope=p[0]??0,id=p[1]??0;return f(command,[scope,id,1,...encodeV14(scope?40:0),...encodeV14(scope?240:127),...encodeV14(scope?120:100),...encodeCString(scope?'BPM':'LEVEL'),...encodeCString(scope?'bpm':'%')]);}if(command===SloopCommand.Dump)return f(command,[0,0,...encodeV14(this.level),...encodeV14(120)]);if(command===SloopCommand.TrackStep)return f(command,[p[0]??0,p[1]??0,0,2,0,0,0,0,0,0]);if(command===SloopCommand.SampleInfo)return f(command,[0,80]);if(command===SloopCommand.Set){this.level=((p[2]??0)|((p[3]??64)<<7))-8192;return f(command,[p[0]??0,p[1]??0,...encodeV14(this.level)]);}if(command===SloopCommand.Watch||command===SloopCommand.Ping)return f(command,[1]);return f(command,p);}
 subscribe(listener:(frame:SloopFrame)=>void){this.listeners.add(listener);return()=>this.listeners.delete(listener);}
}
function f(command:SloopCommand,data:number[]):SloopFrame{return{command,data:Uint8Array.from(data)}}

describe('SloopDeviceSession mocked MIDI boundary',()=>{it('negotiates info, descriptors, tracks and steps',async()=>{const session=new SloopDeviceSession(new MockTransport());await session.connect();const state=session.snapshot();expect(state.connected).toBe(true);expect(state.info?.protocolVersion).toBe(5);expect(state.tracks).toHaveLength(4);expect(state.descriptors.some(d=>d.label==='LEVEL')).toBe(true);expect(state.steps).toHaveLength(4);await session.disconnect();});it('reconciles parameter writes through transport reply',async()=>{const session=new SloopDeviceSession(new MockTransport());await session.connect();const actual=await session.setParameter(0,0,77);expect(actual).toBe(77);expect(session.snapshot().values['0:0']).toBe(77);});});
