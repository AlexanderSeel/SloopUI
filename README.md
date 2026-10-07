# SloopUI

Hardware-first React/Tailwind studio for the **M-VAVE FM-1 running SLOOP firmware**, with a Tone.js/Web Audio virtual mode for editing and composing without the pedal.

## v0.4 — M0–M4 complete

Current `main` includes:

- direct Web MIDI + SysEx connection with explicit FM-1 input/output selection;
- INFO/DESC-driven live synth/global editor with WATCH/PING synchronization;
- four-track hardware mixer with level, pan, mute and read-only firmware arm/solo state;
- factory presets, U01–U32 user preset management and project A–D load/save;
- portable four-track SloopUI project JSON capture/restore;
- DAW-style arranger, hardware step grid and piano roll;
- synth chords (up to four notes/step), velocity, level, accent, slide and ratchet;
- 16-lane drum grid with per-hit level/ratchet;
- rotate/reverse/humanize/quantize, region duplicate/clear and undo;
- sequence JSON and Standard MIDI File import/export;
- virtual playback, probability and descriptor-mapped automation lanes;
- multi-zone Sample Lab with waveform zoom/pan, transient/zero-crossing tools and quantized selections;
- peak/RMS normalization, DC removal, fades, reverse, silence and offline FX/transforms;
- exact FM-1 FSMP v1 + IMA ADPCM + CRC32 sample builder;
- 22.05 kHz resample/downmix, memory estimation, up to 16 zones/loops;
- direct USR1–USR3 `SMP_BEGIN` / `SMP_WRITE` / `SMP_END` upload and erase;
- IndexedDB local sample library and edited WAV export;
- semantic FX rack for firmware effects, Slicer, DUST/DUCK/FILT/ROLL and modulation;
- protocol/sample/MIDI tests plus production TypeScript/Vite build on every `main` push.

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

## Architecture

```text
src/
  protocol/        SLOOP framing/codecs + reference tests
  core/            WebMIDI/virtual transports and SloopDeviceSession
  audio/           FM-1 sample codec, waveform cache, effects, local library
  features/
    effects/       virtual automation runtime
    projects/      full studio project files
    sequencer/     transforms, probability, MIDI/JSON interchange
  ui/components/   device, mixer, sequencer, arranger, Sample Lab, FX, library
```

Hardware and virtual modes share the same session interface. Development is performed directly on `main`.

## Source protocol

Implementation is based on `isod89/sloop-fm1`, particularly `web/EDITOR_PROTOCOL.md`, `web/editor.html`, `web/test_web.mjs`, and `firmware/src/editor.c`.

## Verification note

CI verifies protocol/codec unit tests, TypeScript compilation and the production Vite build. A **physical FM-1 acceptance run still requires a connected device**; no CI environment can validate USB/MIDI electrical behavior or the exact firmware revision on your pedal.
