# Physical FM-1 acceptance checklist

This checklist is the final real-device validation for SloopUI. Automated CI covers protocol framing, codecs, mocked WebMIDI/session behavior and the production build, but cannot replace an attached M-VAVE FM-1 running SLOOP.

## Connection

- [ ] Chrome/Edge requests SysEx permission.
- [ ] FM-1 input/output ports are auto-detected or can be selected explicitly.
- [ ] INFO succeeds and firmware/protocol values match the pedal.
- [ ] WATCH 3 remains alive for at least 5 minutes with PING keepalive.
- [ ] Disconnect/reconnect does not require page reload.
- [ ] Diagnostics shows outgoing/incoming SysEx without dropped/stuck requests.

## Live editor

- [ ] Track 1–4 selection follows the hardware.
- [ ] Device knob changes push into SloopUI.
- [ ] SloopUI knob changes reach hardware and reconcile clamped values.
- [ ] Engine changes reload engine-specific descriptors.
- [ ] Mixer level/pan/mute agree with the pedal.
- [ ] Factory preset, user preset and project A–D operations round-trip correctly.

## Sequencer

- [ ] Synth notes, rests, chords, velocity, accent and slide round-trip.
- [ ] Level/ratchet data round-trips on protocol v5.
- [ ] 16 drum lanes round-trip across all 64 steps.
- [ ] JSON project restore reproduces the expected patterns.
- [ ] MIDI import/export timing aligns to the 1/16 grid as expected.

## Samples

- [ ] SMP_INFO matches all three user slots.
- [ ] A small one-zone sample uploads and plays correctly.
- [ ] Multi-zone root/low/high mapping behaves correctly.
- [ ] Loop start/end has no obvious click after zero-crossing adjustment.
- [ ] 80 KiB guard rejects oversized encoded payloads before upload.
- [ ] Erase clears the selected USR slot.

## Recovery and reconciliation

- [ ] Autosave is produced while editing.
- [ ] Compatible restore recovers the selected track after reconnect.
- [ ] Virtual → hardware reconciliation applies firmware-backed values only.
- [ ] Virtual-only probability/automation/sample mappings remain local and are not silently lost.

## Sign-off

Record firmware version, browser version, operating system, date, and any mismatch found. Do not mark physical hardware acceptance complete until all blocking items above pass on an actual FM-1.
