import * as Tone from 'tone';
import { encodeCString, encodeV14, SloopCommand, type SloopFrame } from '../protocol/sloopProtocol';
import type { ConnectionState, SloopTransport } from './WebMidiSloopTransport';

const PARAMS = [
  ['LEVEL', 0, 127, 100, '%'], ['PAN', -64, 63, 0, ''], ['MUTE', 0, 1, 0, ''],
  ['CUTOFF', 0, 127, 96, '%'], ['RESO', 0, 127, 28, '%'], ['ATTACK', 0, 127, 8, ''],
  ['DECAY', 0, 127, 54, ''], ['SUSTAIN', 0, 127, 92, '%'], ['RELEASE', 0, 127, 44, ''],
  ['DRIVE', 0, 127, 16, '%'], ['LFO', 0, 127, 0, '%'], ['SEND', 0, 127, 24, '%'],
] as const;
const GLOBALS = [['BPM', 40, 240, 120, 'bpm'], ['SWING', 0, 100, 0, '%'], ['MASTER', 0, 127, 100, '%']] as const;

export class VirtualSloopTransport implements SloopTransport {
  state: ConnectionState = 'idle';
  private listeners = new Set<(frame: SloopFrame) => void>();
  private synth = new Tone.PolySynth(Tone.Synth).toDestination();
  private selectedTrack = 0;
  private values = Array.from({ length: 4 }, () => PARAMS.map((p) => p[3] as number));
  private globals = GLOBALS.map((p) => p[3] as number);
  private steps = Array.from({ length: 4 }, () => Array.from({ length: 64 }, (_, index) => ({ index, note: index % 4 === 0 ? 60 + (index % 12) : 0 })));

  async connect(): Promise<void> { await Tone.start(); this.state = 'connected'; }
  async disconnect(): Promise<void> { this.synth.releaseAll(); Tone.Transport.stop(); this.state = 'idle'; }

  async request(command: SloopCommand, data: Iterable<number> = []): Promise<SloopFrame> {
    const p = Uint8Array.from(data);
    if (command === SloopCommand.Ping) return frame(command, [0]);
    if (command === SloopCommand.Watch) return frame(command, [p[0] ?? 0]);
    if (command === SloopCommand.Info) return frame(command, [
      ...encodeCString('SLOOP VIRTUAL 1.0'), 4, PARAMS.length, GLOBALS.length, 64, Math.max(0, PARAMS.length - 8),
      ...encodeCString('ANALOG'), ...encodeCString('WAVETABLE'), ...encodeCString('FM'), ...encodeCString('SAMPLE'),
      4, 5,
    ]);
    if (command === SloopCommand.Track) {
      if (p.length) this.selectedTrack = Math.min(3, p[0]);
      const tracks = Array.from({ length: 4 }, (_, i) => [i === 3 ? 4 : i, 0, ...encodeV14(this.values[i][0]), this.values[i][2] ? 1 : 0, 0]).flat();
      return frame(command, [this.selectedTrack, 4, ...tracks]);
    }
    if (command === SloopCommand.Desc) {
      const scope = p[0] ?? 0; const id = p[1] ?? 0;
      const source = scope ? GLOBALS : PARAMS; const item = source[id] ?? ['P'+id, 0, 127, 0, ''];
      const [label, min, max, def, unit] = item as readonly [string, number, number, number, string];
      return frame(command, [scope, id, label === 'MUTE' ? 11 : label === 'BPM' ? 9 : 1, ...encodeV14(min), ...encodeV14(max), ...encodeV14(def), ...encodeCString(label), ...encodeCString(unit)]);
    }
    if (command === SloopCommand.Dump) {
      const vals = [...this.values[this.selectedTrack].flatMap(encodeV14), ...this.globals.flatMap(encodeV14)];
      return frame(command, [this.selectedTrack === 3 ? 4 : this.selectedTrack, 0, ...vals]);
    }
    if (command === SloopCommand.Set) {
      const scope = p[0] ?? 0; const id = p[1] ?? 0; const raw = ((p[2] ?? 0) | ((p[3] ?? 64) << 7)) - 8192;
      if (scope) this.globals[id] = raw; else this.values[this.selectedTrack][id] = raw;
      return frame(command, [scope, id, ...encodeV14(raw)]);
    }
    if (command === SloopCommand.TrackParam) {
      const track = p[0] ?? 0, id = p[1] ?? 0;
      if (p.length >= 4) this.values[track][id] = ((p[2] ?? 0) | ((p[3] ?? 64) << 7)) - 8192;
      return frame(command, [track, id, ...encodeV14(this.values[track][id] ?? 0)]);
    }
    if (command === SloopCommand.TrackStep) {
      const track = p[0] ?? 0, index = p[1] ?? 0;
      if (p.length > 2) this.steps[track][index] = { index, note: p[2] ? (p[3] ?? 60) : 0 };
      const s = this.steps[track][index];
      return frame(command, [track, index, s.note ? 1 : 0, ...(s.note ? [s.note] : []), s.note ? 0 : 2, 0, 100, 100, 0, 0]);
    }
    if (command === SloopCommand.DrumStep) return frame(command, [p[0] ?? 0, 0, 0, 0, 0,0,0,0,0, 0,0,0,0,0]);
    if (command === SloopCommand.SampleInfo) return frame(command, [3, 80, 1, ...encodeCString('KICK'), 12, 0, 0, ...encodeCString(''), 0, 0, 0, ...encodeCString(''), 0, 0]);
    return frame(command, [...p]);
  }

  subscribe(listener: (frame: SloopFrame) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  audition(note = 'C3', duration = '8n'): void { this.synth.triggerAttackRelease(note, duration); }
}

function frame(command: SloopCommand, data: number[]): SloopFrame { return { command, data: Uint8Array.from(data.map((x) => x & 0x7f)) }; }
