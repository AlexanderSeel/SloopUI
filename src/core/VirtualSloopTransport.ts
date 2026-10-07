import * as Tone from 'tone';
import { SloopCommand, type SloopFrame } from '../protocol/sloopProtocol';
import type { ConnectionState, SloopTransport } from './WebMidiSloopTransport';

export class VirtualSloopTransport implements SloopTransport {
  state: ConnectionState = 'idle';
  private listeners = new Set<(frame: SloopFrame) => void>();
  private synth = new Tone.PolySynth(Tone.Synth).toDestination();

  async connect(): Promise<void> {
    await Tone.start();
    this.state = 'connected';
  }

  async disconnect(): Promise<void> {
    this.synth.releaseAll();
    this.state = 'idle';
  }

  async request(command: SloopCommand, data: Iterable<number> = []): Promise<SloopFrame> {
    const payload = Uint8Array.from(data);
    if (command === SloopCommand.Ping) return { command, data: Uint8Array.of(0) };
    if (command === SloopCommand.Watch) return { command, data: Uint8Array.of(payload[0] ?? 0) };
    if (command === SloopCommand.Info) {
      return { command, data: Uint8Array.from([83, 76, 79, 79, 80, 85, 73, 0, 8, 58, 32, 64, 50, 4, 5]) };
    }
    return { command, data: payload };
  }

  subscribe(listener: (frame: SloopFrame) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  audition(note = 'C3', duration = '8n'): void {
    this.synth.triggerAttackRelease(note, duration);
  }
}
