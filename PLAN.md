# SloopUI — PLAN

## Product direction

SloopUI is a hardware-first studio for the M-VAVE FM-1 running SLOOP firmware, with a virtual Tone.js/Web Audio mode for composing and editing without a connected pedal. The UX target is a compact hardware workstation: tactile panels, dense information, clear signal flow, DAW-grade editing where appropriate, and no generic admin-dashboard styling.

## Architecture

### Layers
- `protocol/`: byte-exact SLOOP SysEx framing, v14 values, pack7, command/request/reply codecs.
- `core/`: transports, device session, protocol-version negotiation, WATCH/PING live sync, state/cache, undoable commands.
- `audio/`: Tone.js/Web Audio virtual SLOOP engine, sample processing, waveform analysis, offline rendering.
- `features/device/`: synth/global parameters generated from firmware `DESC` metadata.
- `features/sequencer/`: 4-track arranger + step/piano-roll/drum-lane editors.
- `features/samples/`: waveform/zone/loop editor, conversion and FM-1 slot upload.
- `features/effects/`: device effects editing plus offline destructive/non-destructive processing.
- `ui/`: reusable hardware controls, dock/panels, transport bar, inspectors and responsive studio shell.

The UI must depend on a `SloopTransport`/device facade, never directly on Web MIDI. Hardware and virtual transports must remain interchangeable.

## Firmware protocol baseline

Source of truth: `isod89/sloop-fm1/web/EDITOR_PROTOCOL.md` and `firmware/src/editor.c`.

- SysEx frame: `F0 7D 46 4C <cmd> <args...> F7`.
- Web MIDI connection must request `{ sysex: true }`.
- Protocol v5: 4 tracks (3 synth + drums), per-note level/ratchet, 16 drum lanes.
- Commands 1–33 include INFO/GET/SET/DESC/DUMP, steps, projects, sample slots, user presets, WATCH/push updates, track mixing/dumps/params, drum steps.
- `WATCH 3` enables base push events plus v4 `TRACK_CHANGED`; session expires after ~3 s of host silence, therefore issue `PING` about once per second.
- Sample slots: 3 × 80 KiB, 44.1 kHz-derived zone rates, IMA ADPCM payload, `FSMP` header and CRC32; uploads use BEGIN/WRITE/END and pack7.
- Never hardcode parameter IDs/ranges that the device can return through INFO/DESC. Engine-specific E0..E7 descriptors must refresh after engine changes.

## Milestones

### M0 — foundation (in progress)
- [x] React + TypeScript + Vite + Tailwind base.
- [x] Compact hardware-inspired studio shell.
- [x] Protocol command enum, framing, v14 codec and pack7.
- [x] Direct Web MIDI transport requesting SysEx.
- [x] INFO probe before declaring hardware connection successful.
- [x] WATCH 3 + 1 s PING keepalive.
- [x] Transport abstraction and initial Tone.js virtual transport.
- [ ] Parse INFO fully and expose negotiated protocol/device capabilities.
- [ ] Robust MIDI port pairing/reconnect UI and explicit port selector.
- [ ] Unit tests against firmware reference vectors.

### M1 — live device editor
- [ ] Device session/state store populated by INFO/DUMP/DESC/TRACK/TRACK_DUMP.
- [ ] Dynamic parameter descriptors and enum labels.
- [ ] Hardware-style knob/fader/toggle/select components with keyboard fine-adjust and reset.
- [ ] Engine pages and global page generated from descriptors.
- [ ] 4-channel mixer: level, pan, mute, solo mask, armed state.
- [ ] Bidirectional live sync from CHANGED/RELOAD/STEP_CHANGED/TRACK_CHANGED.
- [ ] Optimistic writes with clamped reply reconciliation and throttled continuous controls.
- [ ] Factory/user preset browser; store/load/erase; project slots.

### M2 — DAW sequencer
- [ ] Global transport, BPM, position, loop range, metronome and count-in where supported/virtualized.
- [ ] 4 track lanes with zoomable ruler and bar/beat/grid snapping.
- [ ] Synth step editor: up to 4 notes/step, note/tie/rest, accent, slide, velocity, v5 level + ratchet.
- [ ] Drum editor: 16 lanes, on/off, per-hit level and ratchet.
- [ ] Piano roll, step grid and compact hardware-step views backed by the same model.
- [ ] Copy/paste, duplicate, clear, rotate, reverse, humanize, probability/variation (virtual-only where firmware cannot represent it).
- [ ] Quantize strength, swing-aware snapping and non-destructive edit history.
- [ ] Import/export SloopUI project JSON and MIDI where representable.

### M3 — sample laboratory
- [ ] Drag/drop WAV/AIFF/MP3/FLAC decode through browser APIs/decoder adapters.
- [ ] Multi-resolution waveform cache and zoom/pan/scrub selection.
- [ ] Trim/crop, silence, gain, normalize peak/RMS, fades, reverse, DC removal.
- [ ] Time-stretch/pitch-shift/transposition pipeline with preview; preserve original source.
- [ ] Quantized selection boundaries, transient/onset assistance and zero-crossing snap.
- [ ] Resample/downmix and FM-1 memory-size estimator.
- [ ] Up to 16 key zones with root/low/high note, loop start/end, loop enable, audition.
- [ ] IMA ADPCM encoder + loop predictor/step-index calculation, FSMP header, CRC32.
- [ ] SMP_INFO slot browser and safe BEGIN/WRITE/END uploader with progress/retry/error decode.
- [ ] Local library via IndexedDB/OPFS.

### M4 — effects + modulation editor
- [ ] Discover effect/global parameters from DESC and group semantically.
- [ ] Hardware-rack panels for sends, slicer, filter/roll/duck/dust and firmware-exposed processing.
- [ ] Modulation/automation lanes in virtual mode; clear indication when a feature is not firmware-representable.
- [ ] Offline sample effect chain: filter/EQ, dynamics, distortion/saturation, delay/reverb render, normalize at output.

### M5 — virtual SLOOP
- [ ] Tone.js engine abstraction matching SLOOP tracks/patterns/mixer as closely as practical.
- [ ] Virtual synth engines/presets mapped to common descriptor model.
- [ ] Sample/drum playback and effects.
- [ ] Same sequencer/sample editor works with hardware or virtual transport.
- [ ] Offline render/bounce to WAV.
- [ ] Later hardware connection can reconcile/transfer compatible project state without destroying virtual-only data.

### M6 — production quality
- [ ] Responsive desktop/tablet layout, dockable/resizable editor regions.
- [ ] Full keyboard command map, MIDI learn where meaningful, undo/redo command stack.
- [ ] Accessibility for all hardware-style controls.
- [ ] Performance budgets for waveform rendering and dense sequence grids.
- [ ] Persistent preferences, project autosave/recovery, diagnostics/MIDI monitor.
- [ ] Browser compatibility matrix; Chromium WebMIDI/SysEx path documented explicitly.
- [ ] E2E tests with mocked MIDI plus optional hardware acceptance checklist.

## UX principles

1. Dense, tactile and musical: use panel grouping, legends, LEDs/meters and physical-control metaphors, but keep values readable and precise.
2. One model, multiple editors: step grid/piano roll/hardware view edit the same sequence data.
3. Hardware truth is visible: clearly distinguish firmware-backed parameters from virtual-only extensions.
4. Connection state is never implicit: selected MIDI ports, protocol version, WATCH health, pending transfer and errors stay inspectable.
5. Sample edits are non-destructive until explicit render/upload; maintain an operation stack and original PCM source.
6. Never block musical interaction behind modal forms; drilling into details belongs in inspectors/popovers/docked editors.

## Immediate next implementation batch

1. Full INFO/DESC/TRACK parsers + typed capability model.
2. `SloopDeviceSession` with request serialization, push routing, reconnect/watch health and cached track/global state.
3. Explicit MIDI port picker that pairs input/output by normalized names but lets the user override.
4. Replace demo knobs with descriptor-driven controls bound to the device session.
5. Implement sequencer data model + synth TRACK_STEP and DRUM_STEP codecs.
6. Add Vitest protocol fixtures copied from documented/reference behavior, then verify production build.
