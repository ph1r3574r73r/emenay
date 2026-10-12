use std::collections::HashSet;
use std::env;
use std::path::PathBuf;

fn main() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let eurorack = manifest_dir
        .join("../../third-party/eurorack")
        .canonicalize()
        .expect("third-party/eurorack submodule missing — run git submodule update --init");

    println!("cargo:rerun-if-changed=cpp/");
    println!("cargo:rerun-if-changed=include/");
    println!("cargo:rerun-if-changed={}", eurorack.display());

    let mut sources: HashSet<PathBuf> = HashSet::new();
    let mut add = |rel: &str| {
        sources.insert(eurorack.join(rel));
    };

    // Shared stmlib
    add("stmlib/utils/random.cc");
    add("stmlib/dsp/units.cc");
    add("stmlib/dsp/atan.cc");

    if env::var("CARGO_FEATURE_MI_FACETS").is_ok() {
        for f in [
            "plaits/dsp/fm/algorithms.cc",
            "plaits/dsp/engine/additive_engine.cc",
            "plaits/dsp/engine/bass_drum_engine.cc",
            "plaits/dsp/engine/chord_engine.cc",
            "plaits/dsp/engine/fm_engine.cc",
            "plaits/dsp/engine/grain_engine.cc",
            "plaits/dsp/engine/hi_hat_engine.cc",
            "plaits/dsp/engine/modal_engine.cc",
            "plaits/dsp/engine/noise_engine.cc",
            "plaits/dsp/engine/particle_engine.cc",
            "plaits/dsp/engine/snare_drum_engine.cc",
            "plaits/dsp/engine/speech_engine.cc",
            "plaits/dsp/engine/string_engine.cc",
            "plaits/dsp/engine/swarm_engine.cc",
            "plaits/dsp/engine/virtual_analog_engine.cc",
            "plaits/dsp/engine/waveshaping_engine.cc",
            "plaits/dsp/engine/wavetable_engine.cc",
            "plaits/dsp/engine2/chiptune_engine.cc",
            "plaits/dsp/engine2/phase_distortion_engine.cc",
            "plaits/dsp/engine2/six_op_engine.cc",
            "plaits/dsp/engine2/string_machine_engine.cc",
            "plaits/dsp/engine2/virtual_analog_vcf_engine.cc",
            "plaits/dsp/engine2/wave_terrain_engine.cc",
            "plaits/dsp/fm/dx_units.cc",
            "plaits/dsp/chords/chord_bank.cc",
            "plaits/dsp/physical_modelling/modal_voice.cc",
            "plaits/dsp/physical_modelling/resonator.cc",
            "plaits/dsp/physical_modelling/string.cc",
            "plaits/dsp/physical_modelling/string_voice.cc",
            "plaits/dsp/speech/lpc_speech_synth.cc",
            "plaits/dsp/speech/lpc_speech_synth_controller.cc",
            "plaits/dsp/speech/lpc_speech_synth_phonemes.cc",
            "plaits/dsp/speech/lpc_speech_synth_words.cc",
            "plaits/dsp/speech/naive_speech_synth.cc",
            "plaits/dsp/speech/sam_speech_synth.cc",
            "plaits/dsp/voice.cc",
            "plaits/resources.cc",
            "plaits/user_data_receiver.cc",
            "stm_audio_bootloader/fsk/packet_decoder.cc",
        ] {
            add(f);
        }
    }

    if env::var("CARGO_FEATURE_MI_CHIMES").is_ok() {
        for f in [
            "rings/dsp/fm_voice.cc",
            "rings/dsp/part.cc",
            "rings/dsp/resonator.cc",
            "rings/dsp/string.cc",
            "rings/dsp/string_synth_part.cc",
            "rings/resources.cc",
        ] {
            add(f);
        }
    }

    if env::var("CARGO_FEATURE_MI_TWIST").is_ok() {
        for f in [
            "warps/dsp/filter_bank.cc",
            "warps/dsp/modulator.cc",
            "warps/dsp/oscillator.cc",
            "warps/dsp/vocoder.cc",
            "warps/resources.cc",
        ] {
            add(f);
        }
    }

    if env::var("CARGO_FEATURE_MI_SWELL").is_ok() {
        add("tides/generator.cc");
        add("tides/resources.cc");
    }

    if env::var("CARGO_FEATURE_MI_LOTS").is_ok() {
        for f in [
            "marbles/random/discrete_distribution_quantizer.cc",
            "marbles/random/lag_processor.cc",
            "marbles/random/output_channel.cc",
            "marbles/random/quantizer.cc",
            "marbles/random/t_generator.cc",
            "marbles/random/x_y_generator.cc",
            "marbles/ramp/ramp_extractor.cc",
            "marbles/resources.cc",
        ] {
            add(f);
        }
    }

    if env::var("CARGO_FEATURE_MI_TWIN").is_ok() {
        for f in [
            "peaks/processors.cc",
            "peaks/resources.cc",
            "peaks/drums/bass_drum.cc",
            "peaks/drums/snare_drum.cc",
            "peaks/drums/high_hat.cc",
            "peaks/drums/fm_drum.cc",
            "peaks/modulations/lfo.cc",
            "peaks/modulations/multistage_envelope.cc",
            "peaks/pulse_processor/pulse_shaper.cc",
            "peaks/pulse_processor/pulse_randomizer.cc",
            "peaks/number_station/number_station.cc",
        ] {
            add(f);
        }
    }

    let mut cpp_hosts = Vec::new();
    if env::var("CARGO_FEATURE_MI_FACETS").is_ok() {
        cpp_hosts.push("facets_host.cpp");
    }
    if env::var("CARGO_FEATURE_MI_CHIMES").is_ok() {
        cpp_hosts.push("chimes_host.cpp");
    }
    if env::var("CARGO_FEATURE_MI_TWIST").is_ok() {
        cpp_hosts.push("twist_host.cpp");
    }
    if env::var("CARGO_FEATURE_MI_SWELL").is_ok() {
        cpp_hosts.push("swell_host.cpp");
    }
    if env::var("CARGO_FEATURE_MI_LOTS").is_ok() {
        cpp_hosts.push("lots_host.cpp");
    }
    if env::var("CARGO_FEATURE_MI_TWIN").is_ok() {
        cpp_hosts.push("twin_host.cpp");
    }

    let mut build = cc::Build::new();
    build
        .cpp(true)
        .std("c++17")
        .define("TEST", None)
        .include(&eurorack)
        .include(manifest_dir.join("include"))
        .include(manifest_dir.join("cpp"))
        .warnings(false);

    if cfg!(target_arch = "x86_64") {
        build.flag_if_supported("-msse2");
    }

    for host in &cpp_hosts {
        build.file(manifest_dir.join("cpp").join(host));
    }

    let mut sorted: Vec<_> = sources.into_iter().collect();
    sorted.sort();
    for path in sorted {
        build.file(&path);
    }

    build.compile("emenay_mi_firmware");

    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    std::fs::copy(
        manifest_dir.join("src/ffi_bindings.rs"),
        out_dir.join("bindings.rs"),
    )
    .expect("copy ffi bindings");
}
