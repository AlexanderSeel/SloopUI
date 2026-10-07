import type { DrumStepData, StepData } from '../../core/SloopDeviceSession';

export interface SequenceSnapshot {
  synth: StepData[];
  drums: DrumStepData[];
}

export function cloneStep(step: StepData): StepData { return { ...step, notes: [...step.notes] }; }
export function cloneDrumStep(step: DrumStepData): DrumStepData { return { ...step, on: [...step.on], levels: [...step.levels], ratchets: [...step.ratchets] }; }

export function rotateSteps(steps: StepData[], amount: number, length: number): StepData[] {
  const shift = ((amount % length) + length) % length;
  return steps.map(step => ({ ...cloneStep(step), index: (step.index + shift) % length })).sort((a,b)=>a.index-b.index);
}

export function reverseSteps(steps: StepData[], length: number): StepData[] {
  return steps.map(step => ({ ...cloneStep(step), index: length - 1 - step.index })).sort((a,b)=>a.index-b.index);
}

export function duplicateRange(steps: StepData[], from: number, to: number, destination: number, length: number): StepData[] {
  const map = new Map(steps.map(step => [step.index, cloneStep(step)]));
  const span = Math.max(1, to - from + 1);
  for (let offset = 0; offset < span; offset++) {
    const source = map.get(from + offset);
    const index = (destination + offset) % length;
    map.set(index, source ? { ...cloneStep(source), index } : emptyStep(index));
  }
  return [...map.values()].sort((a,b)=>a.index-b.index);
}

export function clearRange(steps: StepData[], from: number, to: number): StepData[] {
  return steps.map(step => step.index >= from && step.index <= to ? emptyStep(step.index) : cloneStep(step));
}

export function humanizeSteps(steps: StepData[], strength = 8): StepData[] {
  return steps.map(step => !step.notes.length ? cloneStep(step) : {
    ...cloneStep(step),
    velocity: clamp(step.velocity + Math.round((Math.random() * 2 - 1) * strength), 1, 127),
    level: clamp(step.level + Math.round((Math.random() * 2 - 1) * strength), 1, 127),
  });
}

export function quantizeVelocity(steps: StepData[], strength = 1, target = 100): StepData[] {
  const mix = clamp(strength, 0, 1);
  return steps.map(step => !step.notes.length ? cloneStep(step) : { ...cloneStep(step), velocity: clamp(Math.round(step.velocity + (target - step.velocity) * mix), 1, 127) });
}

export function rotateDrums(steps: DrumStepData[], amount: number, length: number): DrumStepData[] {
  const shift = ((amount % length) + length) % length;
  return steps.map(step => ({ ...cloneDrumStep(step), index: (step.index + shift) % length })).sort((a,b)=>a.index-b.index);
}

export function reverseDrums(steps: DrumStepData[], length: number): DrumStepData[] {
  return steps.map(step => ({ ...cloneDrumStep(step), index: length - 1 - step.index })).sort((a,b)=>a.index-b.index);
}

export function emptyStep(index: number): StepData { return { index, notes: [], time: 2, flags: 0, velocity: 100, level: 100, ratchet: 0 }; }

export function exportSequenceJson(snapshot: SequenceSnapshot): string {
  return JSON.stringify({ format: 'sloop-ui-sequence', version: 1, ...snapshot }, null, 2);
}

export function importSequenceJson(text: string): SequenceSnapshot {
  const data = JSON.parse(text) as Partial<SequenceSnapshot> & { format?: string };
  if (data.format && data.format !== 'sloop-ui-sequence') throw new Error('Not a SloopUI sequence file.');
  return { synth: Array.isArray(data.synth) ? data.synth.map(cloneStep) : [], drums: Array.isArray(data.drums) ? data.drums.map(cloneDrumStep) : [] };
}

/** Minimal Standard MIDI File type 0 export for the selected synth track. */
export function sequenceToMidi(steps: StepData[], bpm: number, division = 96): Uint8Array {
  const events: number[] = [];
  const stepTicks = division / 4;
  const tempo = Math.round(60000000 / Math.max(1, bpm));
  events.push(0, 0xff, 0x51, 3, (tempo >> 16) & 0xff, (tempo >> 8) & 0xff, tempo & 0xff);
  let cursorTick = 0;
  const sorted = [...steps].sort((a,b)=>a.index-b.index);
  for (const step of sorted) {
    if (!step.notes.length) continue;
    const tick = Math.round(step.index * stepTicks);
    pushVar(events, tick - cursorTick);
    step.notes.forEach((note, i) => events.push(i ? 0 : 0x90, note & 0x7f, step.velocity & 0x7f));
    cursorTick = tick;
    const gate = Math.max(1, Math.round(stepTicks * 0.8));
    pushVar(events, gate);
    step.notes.forEach((note, i) => events.push(i ? 0 : 0x80, note & 0x7f, 0));
    cursorTick += gate;
  }
  events.push(0, 0xff, 0x2f, 0);
  const track = Uint8Array.from(events);
  const out = new Uint8Array(14 + 8 + track.length);
  const view = new DataView(out.buffer);
  writeText(out, 0, 'MThd'); view.setUint32(4, 6, false); view.setUint16(8, 0, false); view.setUint16(10, 1, false); view.setUint16(12, division, false);
  writeText(out, 14, 'MTrk'); view.setUint32(18, track.length, false); out.set(track, 22);
  return out;
}

function pushVar(out: number[], value: number) {
  let buffer = value & 0x7f;
  while ((value >>= 7)) { buffer <<= 8; buffer |= (value & 0x7f) | 0x80; }
  while (true) { out.push(buffer & 0xff); if (buffer & 0x80) buffer >>= 8; else break; }
}
function writeText(bytes: Uint8Array, offset: number, text: string) { for (let i=0;i<text.length;i++) bytes[offset+i]=text.charCodeAt(i); }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
