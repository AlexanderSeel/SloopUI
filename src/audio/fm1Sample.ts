export const FM1_SAMPLE = { SLOT_SIZE: 0x14000, DATA_OFFSET: 512, RATE: 22050, HEADER_LENGTH: 32 + 16 * 28, MAX_ZONES: 16 } as const;
export const FM1_SAMPLE_MAX_DATA = FM1_SAMPLE.SLOT_SIZE - FM1_SAMPLE.DATA_OFFSET;

export interface SampleZoneInput {
  samples: Int16Array;
  root: number;
  low?: number;
  high?: number;
  loopStart?: number;
  loopEnd?: number;
  looped?: boolean;
}

export interface BuiltSampleZone {
  offset: number;
  samples: number;
  loopStart: number;
  loopEnd: number;
  root: number;
  low: number;
  high: number;
  predictor: number;
  stepIndex: number;
  looped: boolean;
}

export interface BuiltFm1Sample {
  header: Uint8Array;
  data: Uint8Array;
  zones: BuiltSampleZone[];
  name: string;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const IMA_STEP = [7,8,9,10,11,12,13,14,16,17,19,21,23,25,28,31,34,37,41,45,50,55,60,66,73,80,88,97,107,118,130,143,157,173,190,209,230,253,279,307,337,371,408,449,494,544,598,658,724,796,876,963,1060,1166,1282,1411,1552,1707,1878,2066,2272,2499,2749,3024,3327,3660,4026,4428,4871,5358,5894,6484,7132,7845,8630,9493,10442,11487,12635,13899,15289,16818,18500,20350,22385,24623,27086,29794,32767];
const IMA_INDEX = [-1,-1,-1,-1,2,4,6,8];

/** SLOOP IMA ADPCM: 4 bit, low nibble first, predictor/index start at zero. */
export function imaEncode(samples: Int16Array, loopStart = 0): { data: Uint8Array; predictor: number; stepIndex: number } {
  let predictor = 0;
  let index = 0;
  let loopPredictor = 0;
  let loopIndex = 0;
  const nibbles = new Uint8Array(samples.length + (samples.length & 1));
  for (let n = 0; n < samples.length; n++) {
    if (n === loopStart) { loopPredictor = predictor; loopIndex = index; }
    const step = IMA_STEP[index];
    let diff = samples[n] - predictor;
    let code = 0;
    if (diff < 0) { code = 8; diff = -diff; }
    let delta = step >> 3;
    if (diff >= step) { code |= 4; diff -= step; delta += step; }
    if (diff >= step >> 1) { code |= 2; diff -= step >> 1; delta += step >> 1; }
    if (diff >= step >> 2) { code |= 1; delta += step >> 2; }
    predictor = Math.max(-32768, Math.min(32767, code & 8 ? predictor - delta : predictor + delta));
    index = Math.max(0, Math.min(88, index + IMA_INDEX[code & 7]));
    nibbles[n] = code;
  }
  const data = new Uint8Array(nibbles.length >> 1);
  for (let k = 0; k < nibbles.length; k += 2) data[k >> 1] = nibbles[k] | (nibbles[k + 1] << 4);
  return { data, predictor: loopPredictor, stepIndex: loopIndex };
}

export function resampleMono(input: Float32Array | Float64Array, sourceRate: number, targetRate = FM1_SAMPLE.RATE): Float32Array {
  if (sourceRate === targetRate) return Float32Array.from(input);
  let source: ArrayLike<number> = input;
  if (sourceRate > targetRate) {
    const kernel = Math.max(1, pythonRound(sourceRate / targetRate));
    if (kernel > 1) {
      const filtered = new Float32Array(input.length);
      for (let i = 0; i < input.length; i++) {
        let sum = 0;
        const end = Math.min(input.length, i + kernel);
        for (let j = i; j < end; j++) sum += input[j];
        filtered[i] = sum / (end - i);
      }
      source = filtered;
    }
  }
  const step = sourceRate / targetRate;
  const output: number[] = [];
  for (let position = 0; position < source.length - 1; position += step) {
    const index = Math.floor(position);
    const fraction = position - index;
    output.push(source[index] * (1 - fraction) + source[index + 1] * fraction);
  }
  return Float32Array.from(output);
}

export function audioBufferToMonoInt16(buffer: AudioBuffer, normalize = true): Int16Array {
  const mono = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const source = buffer.getChannelData(channel);
    for (let i = 0; i < source.length; i++) mono[i] += source[i] / buffer.numberOfChannels;
  }
  const resampled = resampleMono(mono, buffer.sampleRate);
  let peak = 1e-9;
  if (normalize) for (const value of resampled) peak = Math.max(peak, Math.abs(value));
  return Int16Array.from(resampled, value => Math.max(-32768, Math.min(32767, Math.trunc((normalize ? value / peak : value) * 30000))));
}

export function buildFm1Sample(name: string, inputZones: SampleZoneInput[]): BuiltFm1Sample {
  if (!inputZones.length || inputZones.length > FM1_SAMPLE.MAX_ZONES) throw new Error('FM-1 sample slots require 1–16 zones.');
  const zoneParts: Uint8Array[] = [];
  const zones: BuiltSampleZone[] = [];
  let dataLength = 0;
  for (const source of inputZones) {
    if (!source.samples.length) throw new Error('Sample zones cannot be empty.');
    const loopStart = Math.max(0, Math.min(source.samples.length - 1, source.loopStart ?? 0));
    const loopEnd = Math.max(loopStart, Math.min(source.samples.length - 1, source.loopEnd ?? source.samples.length - 1));
    const encoded = imaEncode(source.samples, loopStart);
    zones.push({
      offset: dataLength,
      samples: source.samples.length,
      loopStart,
      loopEnd,
      root: clampMidi(source.root),
      low: source.low == null ? -1 : clampMidi(source.low),
      high: source.high == null ? -1 : clampMidi(source.high),
      predictor: encoded.predictor,
      stepIndex: encoded.stepIndex,
      looped: !!source.looped,
    });
    zoneParts.push(encoded.data);
    dataLength += encoded.data.length;
  }
  if (dataLength > FM1_SAMPLE_MAX_DATA) throw new Error(`Sample data is ${dataLength} bytes; FM-1 maximum is ${FM1_SAMPLE_MAX_DATA} bytes.`);
  zones.sort((a, b) => a.root - b.root);
  zones.forEach((zone, index) => {
    if (zone.low < 0) {
      zone.low = index === 0 ? 0 : Math.floor((zones[index - 1].root + zone.root) / 2) + 1;
      zone.high = index === zones.length - 1 ? 127 : Math.floor((zone.root + zones[index + 1].root) / 2);
    }
  });
  const data = new Uint8Array(dataLength);
  let dataOffset = 0;
  for (const part of zoneParts) { data.set(part, dataOffset); dataOffset += part.length; }
  const header = new Uint8Array(FM1_SAMPLE.HEADER_LENGTH);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x504d5346, true);
  view.setUint16(4, 1, true);
  header[6] = zones.length;
  const cleanName = sanitizeName(name, 8);
  for (let i = 0; i < cleanName.length; i++) header[8 + i] = cleanName.charCodeAt(i);
  view.setUint32(16, data.length, true);
  view.setUint32(20, crc32(data), true);
  const rate = pythonRound(FM1_SAMPLE.RATE / 44100 * 65536);
  zones.forEach((zone, index) => {
    const base = 32 + index * 28;
    [zone.offset, zone.samples, zone.loopStart, zone.loopEnd, rate].forEach((value, field) => view.setUint32(base + field * 4, value >>> 0, true));
    view.setInt16(base + 20, zone.root * 16, true);
    view.setInt16(base + 22, zone.predictor, true);
    header[base + 24] = zone.stepIndex;
    header[base + 25] = zone.low;
    header[base + 26] = zone.high;
    header[base + 27] = zone.looped ? 1 : 0;
  });
  return { header, data, zones, name: cleanName };
}

export function sanitizeName(value: string, max = 12): string {
  return String(value).toUpperCase().replace(/[^\x20-\x7e]/g, '').slice(0, max) || 'SAMPLE';
}

function pythonRound(value: number): number {
  const floor = Math.floor(value);
  const fraction = value - floor;
  return fraction > 0.5 ? floor + 1 : fraction < 0.5 ? floor : floor % 2 ? floor + 1 : floor;
}
function clampMidi(value: number) { return Math.max(0, Math.min(127, Math.round(value))); }
