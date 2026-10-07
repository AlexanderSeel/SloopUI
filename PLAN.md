# SloopUI — PLAN

## Product direction

SloopUI is a hardware-first studio for the M-VAVE FM-1 running SLOOP firmware, with a Tone.js/Web Audio virtual mode for composing and editing without a connected pedal. The UX target is a compact hardware workstation: tactile panels, dense information, clear signal flow, DAW-style editing, and no generic admin-dashboard styling.

## Current release

### v0.6 — M0–M6 complete

M0 through M6 are implemented on `main` and gated by `npm run check` (Vitest protocol/codec/browser-boundary tests + TypeScript/Vite production build).

The browser virtual engine is a behavioral SLOOP model, not a bit-exact port of the FM-1 DSP. It mirrors the firmware topology, descriptors, engines, factory names, E0–E7 controls, mixer/effect behavior, samples and project workflow closely enough for offline composition and editing while keeping the hardware firmware as the sonic source of truth.

Hardware boundaries are explicit rather than simulated: editor protocol v5 exposes the track solo mask and record-arm state in replies but no commands to write them, and it does not expose host play/stop transport commands. SloopUI therefore displays those hardware states, edits every writable field, leaves physical transport on the FM-1, and provides play/pause/probability/automation in virtual mode.

## Architecture

- `protocol/`: byte-exact SLOOP SysEx framing, v14, pack7 and command codecs.
- `core/`: WebMIDI/virtual transports, session/capability state, live push routing, projects/presets/sample transfer, persistence and diagnostics.
- `audio/`: Tone.js virtual engine, firmware descriptor model, FM-1 FSMP/IMA-ADPCM codec, resampling, persistent sample library, waveform peak cache and offline processing/bounce.
- `features/sequencer/`: sequence transforms, MIDI/JSON interchange, probability runtime.
- `features/projects/`: complete portable four-track SloopUI project capture/restore.
- `features/effects/`: virtual automation runtime.
- `ui/components/`: reusable hardware controls, visual scopes, mixer, arranger, sequencer/piano roll, Sample Lab, FX rack, diagnostics and librarians.

The UI depends on `SloopDeviceSession`/`SloopTransport`, never directly on Web MIDI. Hardware and virtual transports use the same session model.

## Firmware protocol baseline

Source of truth: `isod89/sloop-fm1/web/EDITOR_PROTOCOL.md`, `web/editor.html`, `web/test_web.mjs` and `firmware/src/editor.c`.

- SysEx: `F0 7D 46 4C <cmd> <args...> F7`.
- Hardware connection requests Web MIDI `{ sysex: true }`.
- Protocol v5: 4 tracks (3 synth + drums), per-note level/ratchet and 16 drum lanes.
- Commands 1–33 are covered by the session where applicable: INFO/GET/SET/DESC/DUMP, steps, projects, samples, user presets, WATCH/push, track mix/params and drum steps.
- `WATCH 3` + approximately 1 s `PING` maintains live synchronization.
- User samples use the upstream byte layout: 3 × 80 KiB slots, 22.05 kHz PCM preparation, IMA ADPCM low nibble first, 480-byte `FSMP` header, CRC32, pack7 transfers and data offset 512.
- Parameter IDs/ranges are learned through INFO/DESC. Engine-dependent descriptors are re-read after engine changes.

## Milestones

### M0 — foundation — DONE
- [x] React + TypeScript + Vite + Tailwind application.
- [x] Compact hardware-inspired studio shell and reusable UI primitives.
- [x] Commands 1–33, SysEx framing, v14, pack7/unpack7 and string codecs.
- [x] Direct Web MIDI/SysEx transport with INFO probe.
- [x] WATCH 3, PING keepalive, disconnect cleanup and request timeouts.
- [x] Explicit MIDI input/output picker, FM-1/SLOOP scoring and reconnect-safe lifecycle.
- [x] Typed INFO capability parsing and device session abstraction.
- [x] Tone.js virtual transport implementing the same request/session surface.
- [x] Reference tests for SysEx/v14/pack7, CRC32, IMA-ADPCM/FSMP and MIDI interchange.
- [x] GitHub Actions runs tests + production build on every `main` push.

### M1 — live device editor — DONE
- [x] INFO/DUMP/DESC/TRACK-backed state and dynamic descriptors/enums.
- [x] Hardware-style range/enum/toggle controls with exact values.
- [x] Fine keyboard adjustment, Shift ×10, reset and throttled continuous writes.
- [x] Engine/global pages and automatic descriptor reload after `ENG` changes.
- [x] Four-channel mixer with writable level/pan/mute plus visible arm and solo-mask state.
- [x] CHANGED/RELOAD/STEP_CHANGED/TRACK_CHANGED live synchronization.
- [x] Optimistic/draft interaction with clamped-reply reconciliation.
- [x] Factory preset browser.
- [x] User preset U01–U32 list/store/load/erase.
- [x] Project A–D query/load/save with playback-busy handling.
- [x] Portable complete SloopUI project JSON capture/restore across four tracks, globals and patterns.
- [x] Protocol limitation documented: solo/armed are readable but v5 provides no setter.

### M2 — DAW sequencer — DONE
- [x] BPM-aware virtual transport/playhead; hardware BPM/SWING remain descriptor-backed.
- [x] Protocol limitation documented: v5 exposes no host play/stop command, so physical playback remains on the FM-1.
- [x] Four-track arranger overview with zoom, beat/bar ruler/grid references and direct track selection.
- [x] Synth editor: up to four notes per step, note/rest, velocity, accent, slide, v5 level and ratchet.
- [x] 16-lane drum editor with per-hit level/ratchet and complete pattern banking.
- [x] Hardware step grid and piano-roll views edit the same sequence model.
- [x] Rotate left/right, reverse, humanize and adjustable quantization transform.
- [x] Region duplicate/copy-paste equivalent and clear tools.
- [x] Undo snapshots for destructive sequence operations.
- [x] Virtual-only per-track probability, clearly separated from firmware-backed data.
- [x] JSON sequence import/export.
- [x] Standard MIDI File export and note-event MIDI import snapped to the FM-1 1/16 step grid.
- [x] Full SloopUI project JSON import/export via the project librarian.

### M3 — sample laboratory — DONE
- [x] Browser audio decoding for formats supported by the active browser (WAV/MP3 and platform codecs; FLAC/AIFF where the browser exposes decoding).
- [x] Waveform editor with selection, zoom, pan and cached multi-resolution peak infrastructure.
- [x] Selection preview, trim/crop, silence, gain/output processing, fades and reverse.
- [x] Peak normalize, RMS normalize and DC removal.
- [x] BPM-based quantized selection boundaries.
- [x] Transient assistance and zero-crossing snapping.
- [x] Pitch/transposition and time-stretch transform pipeline with post-render preview.
- [x] 22.05 kHz resample/downmix and live FM-1 ADPCM memory estimator.
- [x] Up to 16 zones with root/low/high key, loop enable and loop start/end from the selection.
- [x] Byte-level upstream-compatible IMA ADPCM encoder with loop predictor/step index.
- [x] FSMP v1 header, zone table and CRC32 generation.
- [x] SMP_INFO slot browser and erase.
- [x] SMP_BEGIN / 256-byte SMP_WRITE / SMP_END uploader with progress and firmware return-code decoding.
- [x] WAV export of edited material.
- [x] Persistent local sample library in IndexedDB.
- [x] Offline effects/render chain available directly from Sample Lab.

### M4 — effects + modulation editor — DONE
- [x] Firmware-exposed effects are discovered from DESC rather than hardcoded parameter IDs.
- [x] Semantic hardware-rack grouping for track FX, Slicer, performance FX (DUST/DUCK/FILT/ROLL) and modulation.
- [x] Hardware-backed controls clearly distinguished from virtual-only functionality.
- [x] 16-step virtual automation lanes.
- [x] Virtual playback applies automation values against descriptor min/max ranges in real time.
- [x] Offline sample processing: gain, DC removal, filter, saturation, delay, reverb, peak/RMS normalization.
- [x] Offline pitch/time transform and rendered WAV workflow.

### M5 — deeper virtual SLOOP — DONE
- [x] Full virtual firmware descriptor topology: 58 track parameters, 32 globals and engine-dependent E0–E7 descriptors for all nine standard engines.
- [x] Exact upstream factory preset names with per-preset virtual envelopes/wave character.
- [x] Engine-specific behavioral rendering driven from E0–E7: ANALOG/TRIO waveform/filter character, DIGITAL/PHASE character, LOFI/SAMPLE bit-crush/tone/drive, VOICE resonance, WHEEL rotor motion and GRAIN spread/tone behavior.
- [x] Common track FX are active in the virtual signal path: filter, distortion, chorus, delay and reverb.
- [x] Imported samples can be mapped as pitched instruments to synth tracks 1–3 with selectable root note.
- [x] Imported samples can be mapped independently to all 16 drum lanes.
- [x] Mapped synth/drum samples participate in virtual playback and offline rendering.
- [x] Full multi-track offline song bounce to WAV for three synth tracks plus drums.
- [x] Hardware reconciliation view applies firmware-compatible state while preserving virtual-only automation/probability/sample mappings as local data.
- [x] Scope note: virtual audio is behavioral emulation, not a bit-exact C DSP port; physical FM-1 remains the sound-reference target.

### M6 — production refinement — DONE
- [x] Compact tabbed workspace replaces the original scrolling page.
- [x] Dockable/resizable synth+mixer and sequencer+arranger regions with persistent ratio/orientation/swap state.
- [x] Tablet-specific responsive layout pass with stacked docks and compact controls.
- [x] Signal-flow synth layout: FILTER → AMP ENV → LFO/MOD visual/control alignment.
- [x] Live filter response, ADSR and LFO waveform scopes driven by the same firmware/virtual values as the controls.
- [x] Pseudo-3D hardware skin with 21-dot LED-ring rotary controls and realistic vertical mixer faders/meters.
- [x] Dense non-stretching effects rack to remove wasted panel space.
- [x] Full keyboard command map: transport, workspace switching, track selection, undo dispatch and project open/save.
- [x] MIDI learn for external CC controllers.
- [x] Project autosave/recovery, virtual→hardware reconciliation and preference/workspace persistence.
- [x] MIDI/SysEx diagnostics monitor, raw traffic capture, timeout/error logging and connection health panel.
- [x] Mock-WebMIDI browser-boundary tests covering SysEx permission, port pairing, INFO/WATCH handshake and request/reply traffic.
- [x] Physical FM-1 acceptance checklist in `docs/FM1_ACCEPTANCE.md`.
- [x] Formal browser compatibility matrix in `docs/COMPATIBILITY.md`.
- [x] Reduced-motion/focus-visible accessibility and responsive control sizing.

## Acceptance state

- M0–M6 implementation: complete.
- Automated protocol/unit/browser-boundary tests: enabled in CI.
- TypeScript production build: enabled in CI.
- Latest M5/M6 integration gate: green on `main`.
- Physical FM-1 acceptance: still requires an actual connected FM-1; no software-only run can validate USB/MIDI electrical behavior, firmware-specific timing or final sonic parity.
