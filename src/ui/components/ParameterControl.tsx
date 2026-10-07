import type { ParameterDescriptor } from '../../core/SloopDeviceSession';

export function formatParameterValue(descriptor: ParameterDescriptor, value: number): string {
  if (descriptor.format === 11) return value ? 'ON' : 'OFF';
  if (descriptor.format === 8 && descriptor.enumValues[value - descriptor.min]) return descriptor.enumValues[value - descriptor.min];
  if (descriptor.format === 14) return `${50 + value / 4}%`;
  if (descriptor.format === 2 && value > 0) return `+${value}${descriptor.unit ? ` ${descriptor.unit}` : ''}`;
  return `${value}${descriptor.unit ? ` ${descriptor.unit}` : ''}`;
}

export function ParameterControl({ descriptor, value, onChange }: {
  descriptor: ParameterDescriptor;
  value: number;
  onChange: (value: number) => void;
}) {
  const percent = descriptor.max === descriptor.min ? 0 : (value - descriptor.min) / (descriptor.max - descriptor.min);
  const angle = -135 + Math.max(0, Math.min(1, percent)) * 270;

  return <div className="rounded-lg border border-white/8 bg-black/20 p-3">
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="truncate text-[10px] font-black tracking-[.14em] text-zinc-500" title={descriptor.label}>{descriptor.label}</span>
      <span className="whitespace-nowrap font-mono text-[11px] text-emerald-200">{formatParameterValue(descriptor, value)}</span>
    </div>
    <div className="flex items-center gap-3">
      <div className="knob relative h-11 w-11 shrink-0 rounded-full">
        <span className="absolute left-1/2 top-1 h-4 w-0.5 origin-[50%_18px] -translate-x-1/2 rounded bg-white/80" style={{ transform: `translateX(-50%) rotate(${angle}deg)` }} />
      </div>
      {descriptor.format === 8 && descriptor.enumValues.length > 0
        ? <select value={value} onChange={(event) => onChange(Number(event.target.value))} className="min-w-0 flex-1 rounded border border-white/10 bg-zinc-950 px-2 py-1.5 text-xs">
            {descriptor.enumValues.map((name, index) => <option key={index} value={descriptor.min + index}>{name}</option>)}
          </select>
        : descriptor.format === 11
          ? <button onClick={() => onChange(value ? 0 : 1)} className={`flex-1 rounded border px-2 py-1.5 text-xs font-bold ${value ? 'border-emerald-300/50 bg-emerald-300/15 text-emerald-100' : 'border-white/10 text-zinc-500'}`}>{value ? 'ON' : 'OFF'}</button>
          : <input aria-label={descriptor.label} className="w-full accent-emerald-300" type="range" min={descriptor.min} max={descriptor.max} step={1} value={value} onChange={(event) => onChange(Number(event.target.value))} />}
    </div>
  </div>;
}
