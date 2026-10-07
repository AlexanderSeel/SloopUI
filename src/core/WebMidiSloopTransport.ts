import { decodeFrame, encodeFrame, SloopCommand, type SloopFrame } from '../protocol/sloopProtocol';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

export interface SloopTransport {
  readonly state: ConnectionState;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  request(command: SloopCommand, data?: Iterable<number>, timeoutMs?: number): Promise<SloopFrame>;
  subscribe(listener: (frame: SloopFrame) => void): () => void;
}

declare global {
  interface Navigator {
    requestMIDIAccess?: (options?: { sysex?: boolean; software?: boolean }) => Promise<any>;
  }
}

export class WebMidiSloopTransport implements SloopTransport {
  state: ConnectionState = 'idle';
  private access: any;
  private input: any;
  private output: any;
  private pingTimer?: number;
  private listeners = new Set<(frame: SloopFrame) => void>();
  private pending = new Map<number, Array<{ resolve: (frame: SloopFrame) => void; reject: (error: Error) => void; timer: number }>>();

  async connect(): Promise<void> {
    if (!navigator.requestMIDIAccess) throw new Error('Web MIDI is unavailable in this browser.');
    this.state = 'connecting';
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: true });
      const inputs = [...this.access.inputs.values()];
      const outputs = [...this.access.outputs.values()];
      const score = (port: any) => /m-vave|fm-1|sloop/i.test(`${port?.manufacturer ?? ''} ${port?.name ?? ''}`) ? 10 : 0;
      this.input = inputs.sort((a, b) => score(b) - score(a))[0];
      this.output = outputs.sort((a, b) => score(b) - score(a))[0];
      if (!this.input || !this.output) throw new Error('No MIDI input/output pair found.');
      this.input.onmidimessage = (event: any) => this.onMessage(new Uint8Array(event.data));
      await this.request(SloopCommand.Info, [], 1500);
      await this.request(SloopCommand.Watch, [3], 1000);
      this.pingTimer = window.setInterval(() => void this.request(SloopCommand.Ping, [], 900).catch(() => undefined), 1000);
      this.state = 'connected';
    } catch (error) {
      this.state = 'error';
      await this.disconnect();
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
    this.input = undefined;
    this.output = undefined;
    this.access = undefined;
    this.pending.forEach((queue) => queue.forEach((item) => { window.clearTimeout(item.timer); item.reject(new Error('MIDI disconnected')); }));
    this.pending.clear();
    this.state = 'idle';
  }

  request(command: SloopCommand, data: Iterable<number> = [], timeoutMs = 1200): Promise<SloopFrame> {
    if (!this.output) return Promise.reject(new Error('MIDI device is not connected.'));
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        const queue = this.pending.get(command) ?? [];
        this.pending.set(command, queue.filter((entry) => entry.resolve !== resolve));
        reject(new Error(`SLOOP command ${command} timed out.`));
      }, timeoutMs);
      const queue = this.pending.get(command) ?? [];
      queue.push({ resolve, reject, timer });
      this.pending.set(command, queue);
      this.output.send(encodeFrame(command, data));
    });
  }

  subscribe(listener: (frame: SloopFrame) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
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
