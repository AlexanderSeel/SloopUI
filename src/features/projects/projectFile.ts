import type { DrumStepData, SessionState, SloopDeviceSession, StepData } from '../../core/SloopDeviceSession';

export interface ProjectTrackFile {
  index: number;
  engine: number;
  parameters: Record<number, number>;
  steps: StepData[];
  drums: DrumStepData[];
}
export interface SloopUiProjectFile {
  format: 'sloop-ui-project';
  version: 1;
  createdAt: string;
  firmware?: string;
  protocolVersion?: number;
  selectedTrack: number;
  globals: Record<number, number>;
  tracks: ProjectTrackFile[];
}

export async function captureStudioProject(session: SloopDeviceSession): Promise<SloopUiProjectFile> {
  const original = session.snapshot().selectedTrack;
  const tracks: ProjectTrackFile[] = [];
  let globals: Record<number, number> = {};
  try {
    const count = session.snapshot().info?.trackCount ?? 4;
    for (let track = 0; track < count; track++) {
      await session.selectTrack(track);
      const state = session.snapshot();
      if (!Object.keys(globals).length) globals = valuesForScope(state, 1);
      tracks.push({
        index: track,
        engine: state.tracks[track]?.engine ?? 0,
        parameters: valuesForScope(state, 0),
        steps: state.steps.map(cloneStep),
        drums: state.drumSteps.map(cloneDrum),
      });
    }
  } finally {
    await session.selectTrack(original).catch(() => undefined);
  }
  const state = session.snapshot();
  return { format: 'sloop-ui-project', version: 1, createdAt: new Date().toISOString(), firmware: state.info?.firmware, protocolVersion: state.info?.protocolVersion, selectedTrack: original, globals, tracks };
}

export async function restoreStudioProject(session: SloopDeviceSession, file: SloopUiProjectFile, progress?: (message: string) => void) {
  if (file.format !== 'sloop-ui-project' || file.version !== 1) throw new Error('Unsupported SloopUI project file.');
  const engineDescriptor = () => session.snapshot().descriptors.find(d => d.scope === 1 && d.label.toUpperCase() === 'ENG');
  for (const track of file.tracks.sort((a, b) => a.index - b.index)) {
    progress?.(`Track ${track.index + 1}`);
    await session.selectTrack(track.index);
    if (track.index < 3) {
      const eng = engineDescriptor();
      if (eng) await session.setParameter(1, eng.id, track.engine);
    }
    const descriptors = session.snapshot().descriptors.filter(d => d.scope === 0);
    for (const descriptor of descriptors) {
      const value = track.parameters[descriptor.id];
      if (value != null) await session.setParameter(0, descriptor.id, value);
    }
    if (track.index === 3 && track.drums.length) await session.applyDrumSteps(track.drums);
    else if (track.steps.length) await session.applySteps(track.steps);
  }
  progress?.('Global settings');
  await session.selectTrack(file.selectedTrack ?? 0);
  for (const descriptor of session.snapshot().descriptors.filter(d => d.scope === 1 && d.label.toUpperCase() !== 'ENG')) {
    const value = file.globals[descriptor.id];
    if (value != null && descriptor.max !== descriptor.min) await session.setParameter(1, descriptor.id, value);
  }
  await session.refreshAll();
  progress?.('Ready');
}

export function parseProjectFile(text: string): SloopUiProjectFile {
  const data = JSON.parse(text) as SloopUiProjectFile;
  if (data.format !== 'sloop-ui-project' || data.version !== 1 || !Array.isArray(data.tracks)) throw new Error('Not a SloopUI project file.');
  return data;
}

function valuesForScope(state: SessionState, scope: 0 | 1) {
  const out: Record<number, number> = {};
  for (const descriptor of state.descriptors.filter(d => d.scope === scope)) {
    const value = state.values[`${scope}:${descriptor.id}`];
    if (value != null) out[descriptor.id] = value;
  }
  return out;
}
function cloneStep(step: StepData): StepData { return { ...step, notes: [...step.notes] }; }
function cloneDrum(step: DrumStepData): DrumStepData { return { ...step, on: [...step.on], levels: [...step.levels], ratchets: [...step.ratchets] }; }
