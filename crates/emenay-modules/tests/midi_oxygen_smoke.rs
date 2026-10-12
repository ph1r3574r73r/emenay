//! Smoke: MIDI CC + pads + PolySynth expression paths compile and respond.

use emenay_engine::midi::global_midi_bus;
use emenay_engine::module::Module;
use emenay_modules::{MidiCc, MidiPads, PolySynth};

#[test]
fn midi_cc_tracks_cc_table() {
    let bus = global_midi_bus();
    bus.all_notes_off(None);
    let mut m = MidiCc::new();
    m.set_param("cc_num_1", 20.0);
    bus.handle_message(&[0xb0, 20, 127]);
    let mut outs = vec![0.0; 8];
    m.process(&[], &mut outs);
    assert!(outs[0] > 4.5, "cc1 volts {}", outs[0]);
}

#[test]
fn midi_pads_gm_notes() {
    let bus = global_midi_bus();
    bus.all_notes_off(None);
    let mut m = MidiPads::new();
    bus.handle_message(&[0x90, 36, 100]); // BD
    bus.handle_message(&[0x90, 38, 100]); // SD
    let mut outs = vec![0.0; 4];
    m.process(&[], &mut outs);
    assert!(outs[0] > 1.0, "bd");
    assert!(outs[1] > 1.0, "sd");
    bus.handle_message(&[0x80, 36, 0]);
    m.process(&[], &mut outs);
    assert_eq!(outs[0], 0.0);
    assert!(outs[1] > 1.0);
}

#[test]
fn polysynth_renders_with_expression() {
    let bus = global_midi_bus();
    bus.all_notes_off(None);
    let mut synth = PolySynth::new();
    synth.set_sample_rate(48_000.0);
    synth.set_param("at_cutoff", 0.5);
    synth.set_param("vel_cutoff", 0.3);
    bus.handle_message(&[0x90, 60, 100]);
    bus.handle_message(&[0x90, 64, 90]);
    bus.handle_message(&[0xd0, 100]); // aftertouch
    bus.handle_message(&[0xb0, 1, 80]); // mod
    let mut outs = vec![0.0; 2];
    for _ in 0..512 {
        synth.process(&[], &mut outs);
    }
    assert!(outs[0].abs() + outs[1].abs() > 1e-4, "expected audio");
}
