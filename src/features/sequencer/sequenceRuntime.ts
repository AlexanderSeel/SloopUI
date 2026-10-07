const probabilityByTrack = new Map<number, number>();
const lengthByTrack = new Map<number, number>();
const LENGTH_KEY = 'sloopui.sequenceLengths';

function loadLengths() {
  if (typeof localStorage === 'undefined') return;
  try {
    const saved = JSON.parse(localStorage.getItem(LENGTH_KEY) ?? '[]');
    if (Array.isArray(saved)) saved.forEach((value, track) => {
      if (Number.isFinite(value)) lengthByTrack.set(track, Math.max(1, Math.round(value)));
    });
  } catch {/* optional preference */}
}
loadLengths();

function persistLengths() {
  if (typeof localStorage === 'undefined') return;
  try {
    const values = Array.from({length: 4}, (_, track) => lengthByTrack.get(track));
    localStorage.setItem(LENGTH_KEY, JSON.stringify(values));
  } catch {/* optional preference */}
}

export function setTrackProbability(track: number, probability: number) {
  probabilityByTrack.set(track, Math.max(0, Math.min(1, probability)));
}

export function getTrackProbability(track: number): number {
  return probabilityByTrack.get(track) ?? 1;
}

export function shouldPlayStep(track: number): boolean {
  return Math.random() <= getTrackProbability(track);
}

export function setTrackSequenceLength(track: number, length: number, maximum = 64): number {
  const next = Math.max(1, Math.min(Math.max(1, maximum), Math.round(length)));
  lengthByTrack.set(track, next);
  persistLengths();
  return next;
}

export function getTrackSequenceLength(track: number, maximum = 64): number {
  return Math.max(1, Math.min(Math.max(1, maximum), lengthByTrack.get(track) ?? maximum));
}
