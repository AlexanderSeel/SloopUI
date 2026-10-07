# Browser compatibility

SloopUI has two execution paths: **hardware mode** (Web MIDI + SysEx) and **virtual mode** (Tone.js/Web Audio).

| Browser / runtime | Virtual audio | Web MIDI | SysEx hardware mode | Persistent sample library | Status |
| --- | --- | --- | --- | --- | --- |
| Chrome current desktop | Yes | Yes | Yes, HTTPS/localhost + user permission | Yes | Primary supported path |
| Edge current desktop | Yes | Yes | Yes, HTTPS/localhost + user permission | Yes | Primary supported path |
| Chromium-derived desktop with Web MIDI enabled | Usually | Usually | Browser-dependent | Usually | Best effort |
| Firefox desktop | Yes | No native Web MIDI path | No | Yes | Virtual/editor-only |
| Safari desktop | Yes | No supported Web MIDI SysEx path | No | Yes | Virtual/editor-only |
| Mobile browsers | Web Audio varies by platform | Not relied upon | Not supported for FM-1 workflow | Varies | Secondary/read-only style use |

## Security/runtime requirements

- Hardware mode requires a secure context (`https://`) or localhost.
- The browser must grant `requestMIDIAccess({ sysex: true })`.
- SysEx access is user-mediated by the browser; SloopUI never bypasses that permission gate.
- Virtual mode does not need MIDI permission unless MIDI Learn is used.
- IndexedDB is used for the local sample library.

## Performance targets

- Waveforms use cached peak data rather than redrawing every PCM sample at large zoom levels.
- Dense editor surfaces are separated into workspaces so hidden editors do not remain visually active at the same time.
- The sequencer, synth rack, mixer and sample editor are designed for desktop and tablet-width layouts; narrow mobile layouts are not the main production target.
