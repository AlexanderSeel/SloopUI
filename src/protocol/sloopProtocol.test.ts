import { describe, expect, it } from 'vitest';
import { decodeFrame, decodeV14, encodeFrame, encodeV14, pack7, SloopCommand, unpack7 } from './sloopProtocol';
import { buildFm1Sample, crc32, imaEncode } from '../audio/fm1Sample';
import { midiToSequence, reverseSteps, rotateSteps, sequenceToMidi, type SequenceSnapshot } from '../features/sequencer/sequenceTools';

describe('SLOOP framing',()=>{
 it('uses the documented non-commercial FL SysEx header',()=>{expect([...encodeFrame(SloopCommand.Ping)]).toEqual([0xf0,0x7d,0x46,0x4c,25,0xf7]);expect(decodeFrame(encodeFrame(SloopCommand.Ping))?.command).toBe(SloopCommand.Ping);});
 it('round-trips v14 edge values',()=>{for(const value of [-8192,-64,0,127,8191]){const [lo,hi]=encodeV14(value);expect(decodeV14(lo,hi)).toBe(value);}expect(encodeV14(0)).toEqual([0,64]);});
 it('packs MIDI-safe 7-bit groups byte-exactly',()=>{const source=Uint8Array.from([0x80,0x01,0xff]);expect([...pack7(source)]).toEqual([5,0,1,127]);expect([...unpack7(pack7(source))]).toEqual([...source]);});
});

describe('FM-1 sample codec reference behavior',()=>{
 it('matches the standard CRC32 vector used by the firmware slot header',()=>expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926));
 it('encodes IMA ADPCM low nibble first from predictor/index zero',()=>{const encoded=imaEncode(Int16Array.from([0,1000,-1000,2000]),1);expect([...encoded.data]).toEqual([0x70,0x7f]);expect(encoded.predictor).toBe(0);expect(encoded.stepIndex).toBe(0);});
 it('builds the exact FSMP v1 header shape',()=>{const built=buildFm1Sample('test',[{samples:Int16Array.from({length:32},(_,i)=>i*100-1500),root:60}]);const view=new DataView(built.header.buffer);expect(view.getUint32(0,true)).toBe(0x504d5346);expect(view.getUint16(4,true)).toBe(1);expect(built.header).toHaveLength(480);expect(built.header[6]).toBe(1);expect(view.getUint32(16,true)).toBe(built.data.length);expect(view.getUint32(20,true)).toBe(crc32(built.data));expect(view.getInt16(52,true)).toBe(60*16);});
});

describe('sequence interchange',()=>{
 const steps=[{index:0,notes:[60,64,67],time:0 as const,flags:0,velocity:96,level:96,ratchet:0},{index:4,notes:[62],time:0 as const,flags:1,velocity:110,level:110,ratchet:1}];
 it('round-trips representable notes through a standard MIDI file',()=>{const imported=midiToSequence(sequenceToMidi(steps,120),16);expect(imported[0].notes).toEqual([60,64,67]);expect(imported[4].notes).toEqual([62]);expect(imported[4].velocity).toBe(110);});
 it('rotates and reverses without losing note payload',()=>{const rotated=rotateSteps(steps,1,16);expect(rotated.map(s=>s.index)).toEqual([1,5]);expect(rotated[0].notes).toEqual([60,64,67]);const reversed=reverseSteps(steps,16);expect(reversed.map(s=>s.index)).toEqual([11,15]);});
});
