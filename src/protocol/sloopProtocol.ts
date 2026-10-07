export const SLOOP_HEADER = [0xf0, 0x7d, 0x46, 0x4c] as const;
export const SYSEX_END = 0xf7;

export enum SloopCommand {
  Info = 1, Get = 2, Set = 3, Dump = 4, Desc = 5, StepGet = 6, StepSet = 7,
  Preset = 8, Project = 9, Names = 10, SampleBegin = 11, SampleWrite = 12,
  SampleEnd = 13, SampleErase = 14, SampleInfo = 15, UserPresetList = 16,
  UserPresetGet = 17, UserPresetPut = 18, UserPresetStore = 19, UserPresetLoad = 20,
  UserPresetErase = 21, Watch = 22, Changed = 23, Reload = 24, Ping = 25,
  StepChanged = 26, Track = 27, TrackMix = 28, TrackDump = 29, TrackStep = 30,
  TrackParam = 31, TrackChanged = 32, DrumStep = 33,
}

export interface SloopFrame { command: SloopCommand; data: Uint8Array; }

export function encodeV14(value: number): [number, number] {
  const clamped = Math.max(-8192, Math.min(8191, Math.round(value))) + 8192;
  return [clamped & 0x7f, (clamped >> 7) & 0x7f];
}
export function decodeV14(lo: number, hi: number): number { return (lo | (hi << 7)) - 8192; }
export function encodeFrame(command: SloopCommand, data: Iterable<number> = []): Uint8Array {
  return Uint8Array.from([...SLOOP_HEADER, command, ...Array.from(data, (value) => value & 0x7f), SYSEX_END]);
}
export function decodeFrame(bytes: Uint8Array): SloopFrame | null {
  if (bytes.length < 6 || bytes.at(-1) !== SYSEX_END) return null;
  if (!SLOOP_HEADER.every((value, index) => bytes[index] === value)) return null;
  return { command: bytes[4] as SloopCommand, data: bytes.slice(5, -1) };
}
export function readCString(bytes: Uint8Array, start = 0): { value: string; next: number } {
  let end = start;
  while (end < bytes.length && bytes[end] !== 0) end++;
  const value = new TextDecoder().decode(bytes.slice(start, end));
  return { value, next: Math.min(bytes.length, end + 1) };
}
export function encodeCString(value: string): number[] { return [...new TextEncoder().encode(value), 0].map((x) => x & 0x7f); }
export function pack7(bytes: Uint8Array): Uint8Array {
  const output: number[] = [];
  for (let offset = 0; offset < bytes.length; offset += 7) {
    const chunk = bytes.slice(offset, offset + 7);
    let highBits = 0;
    chunk.forEach((value, index) => { if (value & 0x80) highBits |= 1 << index; });
    output.push(highBits, ...Array.from(chunk, (value) => value & 0x7f));
  }
  return Uint8Array.from(output);
}
export function unpack7(bytes: Uint8Array): Uint8Array {
  const out: number[] = [];
  for (let offset = 0; offset < bytes.length;) {
    const high = bytes[offset++] ?? 0;
    for (let bit = 0; bit < 7 && offset < bytes.length; bit++, offset++) out.push((bytes[offset] & 0x7f) | (((high >> bit) & 1) << 7));
  }
  return Uint8Array.from(out);
}
