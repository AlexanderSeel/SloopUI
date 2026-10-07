import { decodeV14, encodeV14, readCString, SloopCommand, type SloopFrame } from '../protocol/sloopProtocol';
import type { SloopTransport } from './WebMidiSloopTransport';

export type ParamScope = 0 | 1;

export interface DeviceInfo {
  firmware: string;
  engineCount: number;
  parameterCount: number;
  globalCount: number;
  stepCount: number;
  engineParameterStart: number;
  engineNames: string[];
  trackCount: number;
  protocolVersion: number;
}

export interface ParameterDescriptor {
  scope: ParamScope;
  id: number;
  format: number;
  min: number;
  max: number;
  defaultValue: number;
  label: string;
  unit: string;
  enumValues: string[];
}

export interface TrackSummary {
  index: number;
  engine: number;
  preset: number;
  level: number;
  mute: boolean;
  armed: boolean;
}

export interface StepData {
  index: number;
  notes: number[];
  time: 0 | 1 | 2;
  flags: number;
  velocity: number;
  level: number;
  ratchet: number;
}

export interface DrumStepData {
  index: number;
  on: boolean[];
  levels: number[];
  ratchets: number[];
}

export interface SampleSlotInfo {
  index: number;
  zones: number;
  name: string;
  dataKiB: number;
}

export interface SessionState {
  loading: boolean;
  connected: boolean;
  info?: DeviceInfo;
  selectedTrack: number;
  tracks: TrackSummary[];
  descriptors: ParameterDescriptor[];
  values: Record<string, number>;
  steps: StepData[];
  drumSteps: DrumStepData[];
  sampleSlots: SampleSlotInfo[];
  error?: string;
}

function valueKey(scope: ParamScope, id: number) { return `${scope}:${id}`; }

export class SloopDeviceSession {
  private listeners = new Set<(state: SessionState) => void>();
  private unsubscribe?: () => void;
  private state: SessionState = {
    loading: false,
    connected: false,
    selectedTrack: 0,
    tracks: [],
    descriptors: [],
    values: {},
    steps: [],
    drumSteps: [],
    sampleSlots: [],
  };

  constructor(private readonly transport: SloopTransport) {}

  snapshot(): SessionState { return this.state; }
  subscribe(listener: (state: SessionState) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  async connect(): Promise<void> {
    this.patch({ loading: true, error: undefined });
    try {
      await this.transport.connect();
      this.unsubscribe = this.transport.subscribe((frame) => void this.onPush(frame));
      const info = await this.loadInfo();
      this.patch({ info });
      const trackState = await this.loadTracks();
      this.patch({ ...trackState, connected: true });
      await this.loadDescriptors();
      await Promise.all([this.loadSelectedTrack(), this.loadSamples()]);
      this.patch({ loading: false });
    } catch (error) {
      await this.transport.disconnect().catch(() => undefined);
      this.patch({ loading: false, connected: false, error: error instanceof Error ? error.message : 'Connection failed' });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    await this.transport.disconnect();
    this.patch({ connected: false, loading: false });
  }

  async selectTrack(track: number): Promise<void> {
    const reply = await this.transport.request(SloopCommand.Track, [track]);
    const selectedTrack = reply.data[0] ?? track;
    this.patch({ selectedTrack });
    await Promise.all([this.loadDescriptors(), this.loadSelectedTrack()]);
  }

  async setParameter(scope: ParamScope, id: number, value: number): Promise<number> {
    const [lo, hi] = encodeV14(value);
    const reply = await this.transport.request(SloopCommand.Set, [scope, id, lo, hi]);
    const actual = decodeV14(reply.data[2] ?? lo, reply.data[3] ?? hi);
    this.patch({ values: { ...this.state.values, [valueKey(scope, id)]: actual } });
    return actual;
  }

  async setTrackParameter(track: number, id: number, value: number): Promise<number> {
    const [lo, hi] = encodeV14(value);
    const reply = await this.transport.request(SloopCommand.TrackParam, [track, id, lo, hi]);
    const actual = decodeV14(reply.data[2] ?? lo, reply.data[3] ?? hi);
    if (track === this.state.selectedTrack) this.patch({ values: { ...this.state.values, [valueKey(0, id)]: actual } });
    return actual;
  }

  async setStep(step: StepData): Promise<void> {
    const track = this.state.selectedTrack;
    const data = [track, step.index, step.notes.length, ...step.notes.slice(0, 4), step.time, step.flags, step.velocity, step.level & 0x7f, (step.level >> 7) & 0x7f, step.ratchet];
    const reply = await this.transport.request(SloopCommand.TrackStep, data);
    const parsed = this.parseTrackStep(reply.data.slice(1));
    this.patch({ steps: upsertByIndex(this.state.steps, parsed) });
  }

  async toggleStep(index: number, note = 60): Promise<void> {
    const current = this.state.steps.find((x) => x.index === index) ?? { index, notes: [], time: 2 as const, flags: 0, velocity: 100, level: 100, ratchet: 0 };
    const next: StepData = current.notes.length
      ? { ...current, notes: [], time: 2 }
      : { ...current, notes: [note], time: 0, velocity: current.velocity || 100, level: current.level || 100 };
    await this.setStep(next);
  }

  async setDrumLane(stepIndex: number, lane: number, enabled: boolean): Promise<void> {
    const current = this.state.drumSteps.find((x) => x.index === stepIndex) ?? { index: stepIndex, on: Array(16).fill(false), levels: Array(16).fill(2), ratchets: Array(16).fill(0) };
    const next = { ...current, on: [...current.on], levels: [...current.levels], ratchets: [...current.ratchets] };
    next.on[lane] = enabled;
    const onMask = next.on.reduce((mask, on, index) => on ? mask + 2 ** index : mask, 0);
    const levelMask = next.levels.reduce((mask, value, index) => next.on[index] ? mask + ((value | 0) & 3) * 4 ** index : mask, 0);
    const ratchetMask = next.ratchets.reduce((mask, value, index) => next.on[index] ? mask + ((value | 0) & 3) * 4 ** index : mask, 0);
    const reply = await this.transport.request(SloopCommand.DrumStep, [stepIndex, ...to7BitBytes(onMask, 3), ...to7BitBytes(levelMask, 5), ...to7BitBytes(ratchetMask, 5)]);
    const parsed = this.parseDrumStep(reply.data);
    this.patch({ drumSteps: upsertByIndex(this.state.drumSteps, parsed) });
  }

  async refreshSequence(): Promise<void> {
    const info = this.state.info;
    if (!info) return;
    if (this.state.selectedTrack === 3) {
      const drumSteps: DrumStepData[] = [];
      for (let i = 0; i < info.stepCount; i++) drumSteps.push(this.parseDrumStep((await this.transport.request(SloopCommand.DrumStep, [i])).data));
      this.patch({ drumSteps });
    } else {
      const steps: StepData[] = [];
      for (let i = 0; i < info.stepCount; i++) {
        const reply = await this.transport.request(SloopCommand.TrackStep, [this.state.selectedTrack, i]);
        steps.push(this.parseTrackStep(reply.data.slice(1)));
      }
      this.patch({ steps });
    }
  }

  async loadSamples(): Promise<void> {
    try {
      const reply = await this.transport.request(SloopCommand.SampleInfo);
      let offset = 0;
      const slots = reply.data[offset++] ?? 0;
      offset++; // slot capacity KiB
      const sampleSlots: SampleSlotInfo[] = [];
      for (let i = 0; i < slots; i++) {
        const zones = reply.data[offset++] ?? 0;
        const name = readCString(reply.data, offset); offset = name.next;
        const dataKiB = reply.data[offset++] ?? 0;
        sampleSlots.push({ index: i, zones, name: name.value, dataKiB });
      }
      this.patch({ sampleSlots });
    } catch { /* optional on older firmware */ }
  }

  private async loadInfo(): Promise<DeviceInfo> {
    const data = (await this.transport.request(SloopCommand.Info)).data;
    let offset = 0;
    const version = readCString(data, offset); offset = version.next;
    const engineCount = data[offset++] ?? 0;
    const parameterCount = data[offset++] ?? 0;
    const globalCount = data[offset++] ?? 0;
    const stepCount = data[offset++] ?? 16;
    const engineParameterStart = data[offset++] ?? Math.max(0, parameterCount - 8);
    const engineNames: string[] = [];
    for (let i = 0; i < engineCount; i++) { const str = readCString(data, offset); engineNames.push(str.value); offset = str.next; }
    const trackCount = data[offset++] ?? 1;
    const protocolVersion = data[offset++] ?? (trackCount >= 4 ? 3 : 1);
    return { firmware: version.value, engineCount, parameterCount, globalCount, stepCount, engineParameterStart, engineNames, trackCount, protocolVersion };
  }

  private async loadTracks(): Promise<Pick<SessionState, 'selectedTrack' | 'tracks'>> {
    const data = (await this.transport.request(SloopCommand.Track)).data;
    let offset = 0;
    const selectedTrack = data[offset++] ?? 0;
    const count = data[offset++] ?? 1;
    const tracks: TrackSummary[] = [];
    for (let index = 0; index < count; index++) {
      const engine = data[offset++] ?? 0;
      const preset = data[offset++] ?? 0;
      const level = decodeV14(data[offset++] ?? 0, data[offset++] ?? 64);
      const mute = !!data[offset++];
      const armed = !!data[offset++];
      tracks.push({ index, engine, preset, level, mute, armed });
    }
    return { selectedTrack, tracks };
  }

  private async loadDescriptors(): Promise<void> {
    const info = this.state.info;
    if (!info) return;
    const descriptors: ParameterDescriptor[] = [];
    for (const scope of [0, 1] as const) {
      const count = scope === 0 ? info.parameterCount : info.globalCount;
      for (let id = 0; id < count; id++) {
        const data = (await this.transport.request(SloopCommand.Desc, [scope, id])).data;
        let offset = 2;
        const format = data[offset++] ?? 0;
        const min = decodeV14(data[offset++] ?? 0, data[offset++] ?? 64);
        const max = decodeV14(data[offset++] ?? 0, data[offset++] ?? 64);
        const defaultValue = decodeV14(data[offset++] ?? 0, data[offset++] ?? 64);
        const label = readCString(data, offset); offset = label.next;
        const unit = readCString(data, offset); offset = unit.next;
        const enumValues: string[] = [];
        if (format === 8) {
          for (let value = min; value <= max && offset < data.length && enumValues.length < 64; value++) {
            const option = readCString(data, offset); enumValues.push(option.value); offset = option.next;
          }
        }
        descriptors.push({ scope, id, format, min, max, defaultValue, label: label.value || `${scope ? 'G' : 'P'}${id}`, unit: unit.value, enumValues });
      }
    }
    this.patch({ descriptors });
  }

  private async loadSelectedTrack(): Promise<void> {
    const info = this.state.info;
    if (!info) return;
    const dump = (await this.transport.request(SloopCommand.Dump)).data;
    let offset = 2;
    const values: Record<string, number> = { ...this.state.values };
    for (let id = 0; id < info.parameterCount; id++) values[valueKey(0, id)] = decodeV14(dump[offset++] ?? 0, dump[offset++] ?? 64);
    for (let id = 0; id < info.globalCount; id++) values[valueKey(1, id)] = decodeV14(dump[offset++] ?? 0, dump[offset++] ?? 64);
    this.patch({ values });
    await this.refreshSequence();
  }

  private parseTrackStep(data: Uint8Array): StepData {
    let offset = 0;
    const index = data[offset++] ?? 0;
    const count = data[offset++] ?? 0;
    const notes = Array.from(data.slice(offset, offset + count)); offset += count;
    const time = (data[offset++] ?? 2) as 0 | 1 | 2;
    const flags = data[offset++] ?? 0;
    const velocity = data[offset++] ?? 0;
    const level = (data[offset++] ?? velocity) | ((data[offset++] ?? 0) << 7);
    const ratchet = data[offset++] ?? 0;
    return { index, notes, time, flags, velocity, level, ratchet };
  }

  private parseDrumStep(data: Uint8Array): DrumStepData {
    const index = data[0] ?? 0;
    const onMask = from7BitBytes(data.slice(1, 4));
    const levelMask = from7BitBytes(data.slice(4, 9));
    const ratchetMask = from7BitBytes(data.slice(9, 14));
    const on = Array.from({ length: 16 }, (_, lane) => !!((onMask >> lane) & 1));
    const levels = Array.from({ length: 16 }, (_, lane) => Math.floor(levelMask / 4 ** lane) & 3);
    const ratchets = Array.from({ length: 16 }, (_, lane) => Math.floor(ratchetMask / 4 ** lane) & 3);
    return { index, on, levels, ratchets };
  }

  private async onPush(frame: SloopFrame): Promise<void> {
    if (frame.command === SloopCommand.Changed && frame.data.length >= 4) {
      const scope = frame.data[0] as ParamScope;
      const id = frame.data[1];
      const value = decodeV14(frame.data[2], frame.data[3]);
      this.patch({ values: { ...this.state.values, [valueKey(scope, id)]: value } });
    } else if (frame.command === SloopCommand.TrackChanged && frame.data.length >= 4) {
      const [track, id, lo, hi] = frame.data;
      const value = decodeV14(lo, hi);
      this.patch({ tracks: this.state.tracks.map((t) => t.index === track ? { ...t, ...(id === 0 ? { level: value } : {}) } : t) });
    } else if (frame.command === SloopCommand.Reload) {
      const tracks = await this.loadTracks();
      this.patch(tracks);
      await this.loadDescriptors();
      await this.loadSelectedTrack();
    } else if (frame.command === SloopCommand.StepChanged) {
      await this.refreshSequence();
    }
  }

  private patch(patch: Partial<SessionState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }
}

function upsertByIndex<T extends { index: number }>(items: T[], value: T): T[] {
  return items.some((x) => x.index === value.index) ? items.map((x) => x.index === value.index ? value : x) : [...items, value];
}
function to7BitBytes(value: number, count: number): number[] { return Array.from({ length: count }, (_, k) => Math.floor(value / 2 ** (7 * k)) & 0x7f); }
function from7BitBytes(bytes: Uint8Array): number { return Array.from(bytes).reduce((value, byte, k) => value + (byte & 0x7f) * 2 ** (7 * k), 0); }
