# SloopUI

Hardware-first React/Tailwind studio for the **M-VAVE FM-1 running SLOOP firmware**, with a Tone.js/Web Audio virtual mode for editing and composing without the pedal.

## v0.6 — M0–M6 complete

Current `main` includes:

- direct Web MIDI + SysEx connection with explicit FM-1 input/output selection;
- INFO/DESC-driven live synth/global editor with WATCH/PING synchronization;
- compact tabbed hardware-workstation layout instead of one long scrolling page;
- signal-flow synth surface with aligned **FILTER → AMP ENV → LFO/MOD** sections;
- live filter-response, ADSR and LFO waveform scopes tied to the same values as the controls;
- pseudo-3D LED-ring rotary controls and realistic vertical mixer faders/meters;
- persistent resizable/swap/orientation dock layouts for synth+mixer and sequencer+arranger;
- four-track hardware mixer with level, pan, mute and read-only firmware arm/solo state;
- factory presets, U01–U32 user preset management and project A–D load/save;
- portable four-track SloopUI project JSON capture/restore plus global keyboard save/open;
- DAW-style arranger, hardware step grid and piano roll;
- synth chords (up to four notes/step), velocity, level, accent, slide and ratchet;
- 16-lane drum grid with per-hit level/ratchet;
- rotate/reverse/humanize/quantize, region duplicate/clear and undo;
- sequence JSON and Standard MIDI File import/export;
- virtual playback, probability and descriptor-mapped automation lanes;
- full virtual firmware descriptor topology with all nine SLOOP engines and E0–E7 controls;
- engine-specific virtual behavior for ANALOG, DIGITAL, PHASE, LOFI, SAMPLE, VOICE, TRIO, WHEEL and GRAIN;
- Tone.js virtual filter/distortion/chorus/delay/reverb signal path;
- pitched sample mapping to synth tracks 1–3 plus 16 independent drum-pad mappings;
- multi-track offline song bounce including mapped synth/drum samples;
- multi-zone Sample Lab with waveform zoom/pan, transient/zero-crossing tools and quantized selections;
- peak/RMS normalization, DC removal, fades, reverse, silence and offline FX/transforms;
- exact FM-1 FSMP v1 + IMA ADPCM + CRC32 sample builder;
- 22.05 kHz resample/downmix, memory estimation, up to 16 zones/loops;
- direct USR1–USR3 `SMP_BEGIN` / `SMP_WRITE` / `SMP_END` upload and erase;
- IndexedDB local sample library and edited WAV export;
- dense semantic FX rack for firmware effects, Slicer, DUST/DUCK/FILT/ROLL and modulation;
- project autosave/recovery and virtual→hardware compatible-state reconciliation;
- MIDI Learn for external CC controllers;
- raw MIDI/SysEx diagnostics and connection health UI;
- browser compatibility and physical FM-1 acceptance documentation;
- protocol/sample/MIDI/mock-WebMIDI tests plus production TypeScript/Vite build on every `main` push.

The virtual engine is a **behavioral SLOOP model**, not a bit-exact JavaScript port of the firmware DSP. The physical FM-1/SLOOP firmware remains the sonic source of truth.

See `PLAN.md` for milestone details and protocol boundaries.

## Run locally

```bash
npm install
npm run dev
```

Run the full verification gate:

```bash
npm run check
```

Production build only:

```bash
npm run build
```

## Hardware connection

Use a current Chromium browser with Web MIDI SysEx support (Chrome/Edge) from `https://` or localhost.

1. Connect the FM-1 by USB and boot SLOOP firmware.
2. Switch SloopUI to **HARDWARE**.
3. Press **SCAN** and grant MIDI/SysEx permission.
4. Select FM-1 input/output if auto-detection does not choose them.
5. Press **CONNECT FM-1**.
6. SloopUI loads INFO/TRACK/DESC/DUMP, enables `WATCH 3`, and keeps the session alive with PING.

Parameter IDs and ranges are read from firmware metadata. Engine changes re-read engine-dependent descriptors instead of relying on hardcoded indexes.

### Firmware transport limitations

SLOOP editor protocol v5 does not expose host play/stop commands and does not define setters for the returned solo-mask or record-arm state. SloopUI therefore:

- leaves physical playback/record transport on the FM-1;
- shows arm/solo state from the device;
- edits every protocol-writable mixer/sequence parameter;
- provides play/pause, probability and automation in virtual mode.

## Virtual mode

Virtual mode uses the same `SloopDeviceSession` request model as the hardware transport. It exposes the full common parameter block plus engine-dependent E0–E7 controls for the nine normal firmware engines.

The browser renderer applies those controls to an engine-specific Tone.js model, including per-track filter/drive/chorus/delay/reverb, LOFI/SAMPLE bit-crushing, WHEEL rotor modulation and engine-specific waveform/filter character. Factory preset names mirror the upstream firmware; their browser rendering is approximate rather than bit-exact.

The **Virtual Sample Map** can replace a synth track with a pitched browser sample (selectable root note) or map audio independently to any of the 16 drum lanes. These mappings are included in offline song bounce.

## Sample Lab → FM-1

Load one or more browser-decodable audio files. Each source can become a key zone with root/low/high notes and an optional loop. SloopUI prepares the hardware slot using the same layout as the upstream editor:

- mono 22.05 kHz preparation;
- peak-normalized int16 source;
- IMA ADPCM, low nibble first;
- predictor/index captured at loop start;
- 480-byte `FSMP` v1 header;
- CRC32 of ADPCM data;
- max 16 zones;
- max slot data enforced before upload;
- 256-byte packed SysEx transfer chunks.

Select USR1/USR2/USR3 and use **UPLOAD**. Slot contents can also be inspected and erased.

## Keyboard

- `Space`: virtual play/pause
- `Esc`: stop
- `Ctrl/Cmd+S`: save portable SloopUI project
- `Ctrl/Cmd+O`: restore portable SloopUI project
- `Ctrl/Cmd+Z`: dispatch undo to the active editor
- `Alt+1…6`: Synth / Sequence / Samples / FX / Library / System
- `Alt+Shift+1…4`: select track 1…4

## Architecture

```text
src/
  protocol/        SLOOP framing/codecs + reference tests
  core/            WebMIDI/virtual transports, session, persistence, diagnostics
  audio/           virtual engine, firmware descriptors, FM-1 sample codec, waveform/effects/bounce
  features/
    effects/       virtual automation runtime
    projects/      full studio project files
    sequencer/     transforms, probability, MIDI/JSON interchange
  ui/components/   hardware controls/scopes, mixer, sequencer, arranger, Sample Lab, FX, library/system
```

Hardware and virtual modes share the same session interface. Development is performed directly on `main`.

## Compatibility and hardware acceptance

See:

- `docs/COMPATIBILITY.md`
- `docs/FM1_ACCEPTANCE.md`

CI verifies protocol/codec unit tests, mocked WebMIDI/SysEx browser-boundary behavior, TypeScript compilation and the production Vite build. A **physical FM-1 acceptance run still requires a connected device**; no CI environment can validate USB/MIDI electrical behavior, firmware-specific timing or final sonic parity.

## Source protocol

Implementation is based on `isod89/sloop-fm1`, particularly `web/EDITOR_PROTOCOL.md`, `web/editor.html`, `web/test_web.mjs`, and `firmware/src/editor.c`.
