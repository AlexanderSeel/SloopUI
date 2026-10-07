import { decodeFrame, encodeFrame, SloopCommand, type SloopFrame } from '../protocol/sloopProtocol';
import type { MidiPortDescriptor, MidiPortSelection } from './portTypes';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

export interface SloopTransport {
  readonly state: ConnectionState;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  request(command: SloopCommand, data?: Iterable<number>, timeoutMs?: number): Promise<SloopFrame>;
  subscribe(listener: (frame: SloopFrame) => void): () => void;
}

export class WebMidiSloopTransport implements SloopTransport {
  state: ConnectionState = 'idle';
  private access: MIDIAccess | undefined;
  private input: MIDIInput | undefined;
  private output: MIDIOutput | undefined;
  private pingTimer?: number;
  private listeners = new Set<(frame: SloopFrame) => void>();
  private pending = new Map<number, Array<{ resolve: (frame: SloopFrame) => void; reject: (error: Error) => void; timer: number }>>();

  constructor(private readonly selection: MidiPortSelection = {}) {}

  static async listPorts(): Promise<MidiPortDescriptor[]> {
    if (!navigator.requestMIDIAccess) throw new Error('Web MIDI is unavailable in this browser.');
    const access = await navigator.requestMIDIAccess({ sysex: true });
    const mapPort = (port: MIDIPort, type: 'input' | 'output'): MidiPortDescriptor => ({
      id: port.id, name: port.name ?? 'Unnamed MIDI port', manufacturer: port.manufacturer ?? '', type,
    });
    return [
      ...Array.from(access.inputs.values(), (port) => mapPort(port, 'input')),
      ...Array.from(access.outputs.values(), (port) => mapPort(port, 'output')),
    ];
  }

  async connect(): Promise<void> {
    if (!navigator.requestMIDIAccess) throw new Error('Web MIDI is unavailable in this browser. Use Chrome/Edge over HTTPS or localhost.');
    this.state = 'connecting';
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: true });
      const inputs = [...this.access.inputs.values()];
      const outputs = [...this.access.outputs.values()];
      this.input = this.choosePort(inputs, this.selection.inputId);
      this.output = this.choosePort(outputs, this.selection.outputId);
      if (!this.input || !this.output) throw new Error('No MIDI input/output pair found. Select the FM-1 ports explicitly and retry.');
      await this.input.open();
      await this.output.open();
      this.input.onmidimessage = (event) => { if (event.data) this.onMessage(new Uint8Array(event.data)); };
      this.access.onstatechange = () => {
        if (this.input?.state === 'disconnected' || this.output?.state === 'disconnected') void this.disconnect();
      };
      await this.request(SloopCommand.Info, [], 1800);
      await this.request(SloopCommand.Watch, [3], 1200);
      this.pingTimer = window.setInterval(() => void this.request(SloopCommand.Ping, [], 900).catch(() => undefined), 1000);
      this.state = 'connected';
    } catch (error) {
      await this.disconnect();
      this.state = 'error';
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pingTimer) window.clearInterval(this.pingTimer);
    this.pingTimer = undefined;
    if (this.output) {
      try { this.output.send(encodeFrame(SloopCommand.Watch, [0])); } catch { /* disconnected */ }
    }
    if (this.input) this.input.onmidimessage = null;
    if (this.access) this.access.onstatechange = null;
    try { await this.input?.close(); } catch { /* optional */ }
    try { await this.output?.close(); } catch { /* optional */ }
    this.input = undefined;
    this.output = undefined;
    this.access = undefined;
    this.pending.forEach((queue) => queue.forEach((item) => { window.clearTimeout(item.timer); item.reject(new Error('MIDI disconnected')); }));
    this.pending.clear();
    this.state = 'idle';
  }

  request(command: SloopCommand, data: Iterable<number> = [], timeoutMs = 1200): Promise<SloopFrame> {
    const output = this.output;
    if (!output) return Promise.reject(new Error('MIDI device is not connected.'));
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        const queue = this.pending.get(command) ?? [];
        this.pending.set(command, queue.filter((entry) => entry.resolve !== resolve));
        reject(new Error(`SLOOP command ${command} timed out.`));
      }, timeoutMs);
      const queue = this.pending.get(command) ?? [];
      queue.push({ resolve, reject, timer });
      this.pending.set(command, queue);
      output.send(encodeFrame(command, data));
    });
  }

  subscribe(listener: (frame: SloopFrame) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private choosePort<T extends MIDIPort>(ports: T[], requestedId?: string): T | undefined {
    if (requestedId) return ports.find((port) => port.id === requestedId);
    const score = (port: MIDIPort) => /m-vave|fm-1|sloop/i.test(`${port.manufacturer ?? ''} ${port.name ?? ''}`) ? 100 : 0;
    return [...ports].sort((a, b) => score(b) - score(a))[0];
  }

  private onMessage(bytes: Uint8Array): void {
    const frame = decodeFrame(bytes);
    if (!frame) return;
    const queue = this.pending.get(frame.command);
    if (queue?.length) {
      const item = queue.shift()!;
      window.clearTimeout(item.timer);
      item.resolve(frame);
      if (!queue.length) this.pending.delete(frame.command);
      return;
    }
    this.listeners.forEach((listener) => listener(frame));
  }
}
