# SloopUI

A hardware-first React/Tailwind studio for the **M-VAVE FM-1 running SLOOP firmware**, plus a Tone.js virtual mode for working without the pedal.

## v0.1 — first usable version

Current `main` can:

- connect directly to SLOOP over Web MIDI + SysEx;
- scan/select MIDI input and output ports, with FM-1/SLOOP auto-detection;
- negotiate firmware/protocol capabilities through `INFO`;
- maintain `WATCH 3` live sync with the required PING keepalive;
- build the synth/global editor dynamically from firmware `DESC` metadata;
- switch among the four SLOOP tracks and follow firmware parameter/sequence changes;
- edit synth steps across the complete pattern: note, velocity, level, ratchet, accent and slide;
- edit all 16 drum lanes across banked pattern steps;
- work offline through a protocol-compatible Tone.js virtual SLOOP and play patterns;
- load local audio, inspect the waveform, select/crop, fade, normalize, reverse, preview and export WAV;
- read FM-1 user sample-slot information.

See `PLAN.md` for the full roadmap and the exact post-v0.1 limitations.

## Run locally

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

The build is also verified on every push to `main` by GitHub Actions.

## Hardware connection

Use a Chromium browser with Web MIDI SysEx support, such as current Chrome or Edge. The app must be served from a secure context (`https://`) or localhost.

1. Connect the FM-1 by USB and start the SLOOP firmware.
2. Open SloopUI and switch the top-right mode to **HARDWARE**.
3. Press **SCAN** and grant MIDI/SysEx permission.
4. Normally SloopUI recognizes the FM-1/SLOOP ports automatically. If more than one MIDI device is present, select the input and output explicitly.
5. Press **CONNECT FM-1**.
6. After `INFO`, `TRACK`, `DESC` and current state have loaded, controls become live and device-side changes are mirrored through SLOOP's push protocol.

SloopUI uses the firmware's protocol metadata rather than hardcoding engine parameter IDs. Changing global `ENG` therefore reloads the engine-dependent descriptors and values.

## Virtual/offline mode

Virtual mode deliberately goes through the same `SloopDeviceSession` and protocol abstraction as the physical device. This keeps editor features reusable and prevents hardware/virtual implementations from drifting into separate applications.

Press **START VIRTUAL SLOOP** to enable Tone.js audio. You can edit parameters/patterns, audition notes and use the virtual transport playhead without an FM-1 connected.

## Sample Lab

The v0.1 Sample Lab supports local browser decoding and editing:

- waveform display;
- selection start/end;
- preview selection;
- trim/crop;
- 50 ms fade-in/fade-out;
- peak normalization;
- reverse;
- WAV export.

FM-1 slot discovery via `SMP_INFO` is implemented. The exact SLOOP FSMP/IMA-ADPCM builder and `SMP_BEGIN`/`SMP_WRITE`/`SMP_END` upload pipeline are the next major sample milestone and are **not** claimed as complete in v0.1.

## Architecture

```text
src/
  protocol/                 SLOOP SysEx framing/codecs
  core/
    WebMidiSloopTransport   direct hardware transport
    VirtualSloopTransport   Tone.js protocol-compatible virtual device
    SloopDeviceSession      negotiated device/session state
  ui/
    components/             reusable hardware editor, sequencer, sample/connection panels
```

The UI talks to the session/transport abstraction rather than Web MIDI directly. Development is performed directly on `main`, as defined for this project.

## Source protocol

The implementation follows the SLOOP firmware editor protocol in `isod89/sloop-fm1`, especially `web/EDITOR_PROTOCOL.md`, `web/editor.html`, and `firmware/src/editor.c`.
