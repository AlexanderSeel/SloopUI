const cache = new WeakMap<AudioBuffer, Map<number, Float32Array>>();

export function waveformPeaks(buffer: AudioBuffer, buckets: number): Float32Array {
  const safeBuckets = Math.max(32, Math.min(8192, Math.round(buckets)));
  let byResolution = cache.get(buffer);
  if (!byResolution) {
    byResolution = new Map();
    cache.set(buffer, byResolution);
  }
  const cached = byResolution.get(safeBuckets);
  if (cached) return cached;
  const data = buffer.getChannelData(0);
  const peaks = new Float32Array(safeBuckets * 2);
  const stride = data.length / safeBuckets;
  for (let bucket = 0; bucket < safeBuckets; bucket++) {
    const from = Math.floor(bucket * stride);
    const to = Math.max(from + 1, Math.min(data.length, Math.ceil((bucket + 1) * stride)));
    let min = 1;
    let max = -1;
    for (let i = from; i < to; i++) {
      const value = data[i];
      if (value < min) min = value;
      if (value > max) max = value;
    }
    peaks[bucket * 2] = min;
    peaks[bucket * 2 + 1] = max;
  }
  byResolution.set(safeBuckets, peaks);
  return peaks;
}
