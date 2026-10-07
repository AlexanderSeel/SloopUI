const probabilityByTrack = new Map<number, number>();

export function setTrackProbability(track: number, probability: number) {
  probabilityByTrack.set(track, Math.max(0, Math.min(1, probability)));
}

export function getTrackProbability(track: number): number {
  return probabilityByTrack.get(track) ?? 1;
}

export function shouldPlayStep(track: number): boolean {
  return Math.random() <= getTrackProbability(track);
}
