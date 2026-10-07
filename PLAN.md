# SloopUI — PLAN

## Product direction

SloopUI is a hardware-first studio for the M-VAVE FM-1 running SLOOP firmware, with a virtual Tone.js/Web Audio mode for composing and editing without a connected pedal. The UX target is a compact hardware workstation: tactile panels, dense information, clear signal flow, DAW-grade editing where appropriate, and no generic admin-dashboard styling.

## Current release

### v0.1 — first usable studio

The first usable milestone is now implemented and production-build verified on `main`.

Usable now:
- Direct FM-1 Web MIDI/SysEx connection, explicit input/output selection and auto-detection.
- INFO negotiation, protocol version/capability parsing, WATCH 3 and PING live-sync lifecycle.
- Descriptor-driven hardware editor for selected-track and global parameters.
- Automatic descriptor/state reload after engine changes through global `ENG`.
- Four-track selection and live parameter synchronization from firmware push frames.
- Synth sequence editing across the complete firmware step count with note insertion, velocity, level, ratchet, accent and slide.
- Drum editor with 16 lanes and banked access to the complete firmware step count.
- Tone.js virtual mode using the same session/protocol abstraction, including pattern playback and audition.
- Sample Lab: browser audio decode, waveform, selection, preview, crop/trim, fades, normalize, reverse and WAV export.
- Hardware sample-slot discovery through `SMP_INFO`.
- GitHub Actions production build verification.

Still intentionally post-v0.1:
- Upload edited samples to FM-1 (`SMP_BEGIN/WRITE/END`) with the exact FSMP/IMA-ADPCM encoder.
- Full mixer/solo/arm UI, user-preset/project management and factory preset browser.
- Piano roll/arranger, copy/paste/transform/quantization history and project/MIDI import-export.
- Advanced sample zone/loop editing, time-stretch/pitch shifting and transient/zero-crossing tools.
- Dedicated effects/routing panels, virtual automation and offline bounce.
- Hardware acceptance testing against a physical FM-1; CI verifies compilation/build, not the electrical/device connection.

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

### M0 — foundation
- [x] React + TypeScript + Vite + Tailwind base.
- [x] Compact hardware-inspired studio shell.
- [x] Protocol command enum, framing, v14 codec and pack7.
- [x] Direct Web MIDI transport requesting SysEx.
- [x] INFO probe before declaring hardware connection successful.
- [x] WATCH 3 + 1 s PING keepalive.
- [x] Transport abstraction and Tone.js virtual transport.
- [x] Parse INFO fully and expose negotiated protocol/device capabilities.
- [x] Robust MIDI port pairing/reconnect behavior and explicit port selector.
- [ ] Unit tests against firmware reference vectors.

### M1 — live device editor
- [x] Device session/state store populated by INFO/DUMP/DESC/TRACK.
- [x] Dynamic parameter descriptors and enum labels.
- [x] Hardware-style knob/range/toggle/select controls.
- [x] Engine/global pages generated from descriptors.
- [ ] 4-channel mixer: level, pan, mute, solo mask, armed state.
- [x] Bidirectional live sync from CHANGED/RELOAD/STEP_CHANGED/TRACK_CHANGED.
- [x] Clamped reply reconciliation for parameter writes.
- [ ] Throttled continuous controls for very dense hardware edits.
- [ ] Factory/user preset browser; store/load/erase; project slots.

### M2 — DAW sequencer
- [x] Virtual transport playback with BPM-aware playhead.
- [x] Synth step editor: note/rest, accent, slide, velocity, v5 level + ratchet.
- [x] Drum editor: 16 lanes, on/off and complete step-count banking.
- [ ] Up to 4 chord notes per synth step editor UI.
- [ ] Global hardware transport controls where firmware exposes/accepts them.
- [ ] 4 track arranger lanes with zoomable ruler and bar/beat/grid snapping.
- [ ] Piano roll and compact hardware-step views backed by the same model.
- [ ] Copy/paste, duplicate, clear, rotate, reverse, humanize, probability/variation.
- [ ] Quantize strength, swing-aware snapping and non-destructive edit history.
- [ ] Import/export SloopUI project JSON and MIDI where representable.

### M3 — sample laboratory
- [x] Browser audio decode for common formats supported by the browser.
- [x] Waveform display and selectable edit region.
- [x] Trim/crop, normalize, fades and reverse.
- [x] Selection preview and edited WAV export.
- [x] SMP_INFO hardware slot browser.
- [ ] Multi-resolution waveform cache and zoom/pan/scrub.
- [ ] Silence/gain/RMS normalize/DC removal.
- [ ] Time-stretch/pitch-shift/transposition pipeline with preview.
- [ ] Quantized selection boundaries, transient/onset assistance and zero-crossing snap.
- [ ] Resample/downmix and FM-1 memory-size estimator.
- [ ] Up to 16 key zones with root/low/high note, loop start/end, loop enable, audition.
- [ ] IMA ADPCM encoder + loop predictor/step-index calculation, FSMP header, CRC32.
- [ ] Safe BEGIN/WRITE/END uploader with progress/retry/error decode.
- [ ] Local library via IndexedDB/OPFS.

### M4 — effects + modulation editor
- [x] Firmware effect/global parameters are available through descriptor-generated controls.
- [ ] Semantic grouping and dedicated hardware-rack panels for sends, slicer, filter/roll/duck/dust.
- [ ] Modulation/automation lanes in virtual mode; clear indication when a feature is not firmware-representable.
- [ ] Offline sample effect chain: filter/EQ, dynamics, distortion/saturation, delay/reverb render, normalize at output.

### M5 — virtual SLOOP
- [x] Tone.js transport abstraction using the same SLOOP session model.
- [x] Virtual tracks, descriptors, parameter editing and basic synth audition.
- [x] Virtual sequence playback for synth/drum patterns.
- [x] Same sequencer/sample editor shell works in hardware or virtual mode.
- [ ] Closer virtual approximations of all SLOOP synth engines/presets.
- [ ] Sample/drum kit playback mapped to imported content.
- [ ] Offline render/bounce to WAV.
- [ ] Later hardware connection can reconcile/transfer compatible project state without destroying virtual-only data.

### M6 — production quality
- [x] Production TypeScript/Vite build in GitHub Actions.
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
6. Never block musical interaction behind modal forms; details belong in inspectors/popovers/docked editors.

## Next implementation batch after v0.1

1. Exact FM-1 sample builder/uploader: PCM preparation, IMA ADPCM, FSMP zones/loops/CRC, memory estimator and `SMP_BEGIN/WRITE/END` progress/error handling.
2. Four-track mixer with pan/mute/solo/arm plus dedicated parameter groups/effect rack.
3. User presets + project slots and JSON project persistence.
4. Sequencer transform tools: copy/paste, rotate, reverse, quantize/swing and piano roll.
5. Protocol/reference tests ported from upstream `web/test_web.mjs` and mocked Web MIDI E2E coverage.
