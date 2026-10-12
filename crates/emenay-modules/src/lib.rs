//! Built-in modules for emenay.

#[cfg(feature = "inspired-fallback")]
mod inspired;

mod adsr;
mod ar;
mod beat;
mod boost;
mod clock;
mod clk_mult;
mod cv_switch;
mod delay;
mod divider;
mod drift;
mod drums;
mod envelope;
mod erica_bassline;
mod erica_bbd;
mod erica_modulator;
mod erica_polivoks_vcf;
mod erica_swamp;
mod erica_vco3;
mod lfo;
mod lots;
mod midi_cc;
mod midi_cv;
mod midi_pads;
mod mixer;
mod polysynth;
mod mult;
mod noise;
mod offset;
mod output;
mod facets;
mod rc_filter;
mod reverb;
mod chimes;
mod rng;
mod sample_hold;
mod sampler;
mod sequencer;
mod speaker;
mod stereo;
mod switch;
mod test_tone;
mod swell;
mod vca;
mod vcf;
mod vco;
mod twist;
mod twin;
mod wasp;
mod bitboy;

use emenay_engine::module::ModuleFactory;
use emenay_engine::PatchGraph;
use std::collections::HashMap;

pub use adsr::Adsr;
pub use ar::Ar;
pub use beat::Beat;
pub use boost::Boost;
pub use clock::Clock;
pub use clk_mult::ClkMult;
pub use cv_switch::CvSwitch;
pub use delay::Delay;
pub use divider::Divider;
pub use drift::Drift;
pub use drums::Drums;
pub use envelope::Envelope;
pub use erica_bassline::EricaBassline;
pub use erica_bbd::EricaBbd;
pub use erica_modulator::EricaModulator;
pub use erica_polivoks_vcf::EricaPolivoksVcf;
pub use erica_swamp::EricaSwamp;
pub use erica_vco3::EricaVco3;
pub use lfo::Lfo;
pub use lots::Lots;
pub use midi_cc::MidiCc;
pub use midi_cv::MidiCv;
pub use midi_pads::MidiPads;
pub use mixer::EricaMixer;
pub use polysynth::PolySynth;
pub use mult::Mult;
pub use noise::Noise;
pub use offset::OffsetAtten;
pub use output::EricaOutput;
pub use facets::Facets;
pub use rc_filter::RcFilterModule;
pub use reverb::Reverb;
pub use chimes::Chimes;
pub use rng::Rng;
pub use sample_hold::SampleHold;
pub use sampler::Sampler;
pub use sequencer::{Sequencer, Sequencer16, Sequencer32, Sequencer64};
pub use speaker::Speaker;
pub use stereo::Stereo;
pub use switch::SeqSwitch;
pub use test_tone::TestTone;
pub use swell::Swell;
pub use vca::DualVca;
pub use vcf::Vcf;
pub use vco::SimpleVco;
pub use twist::Twist;
pub use twin::Twin;
pub use wasp::Wasp;
pub use bitboy::Bitboy;

pub fn register_all(factories: &mut HashMap<String, ModuleFactory>) {
    factories.insert("test_tone".into(), || Box::new(TestTone::new()));
    factories.insert("speaker".into(), || Box::new(Speaker::new(2)));
    factories.insert("rc_lpf".into(), || Box::new(RcFilterModule::new()));
    factories.insert("erica_mixer".into(), || Box::new(EricaMixer::new()));
    factories.insert("erica_output".into(), || Box::new(EricaOutput::new()));
    factories.insert("midi_cv".into(), || Box::new(MidiCv::new()));
    factories.insert("midi_cc".into(), || Box::new(MidiCc::new()));
    factories.insert("midi_pads".into(), || Box::new(MidiPads::new()));
    factories.insert("polysynth".into(), || Box::new(PolySynth::new()));
    factories.insert("envelope".into(), || Box::new(Envelope::new()));
    factories.insert("dual_vca".into(), || Box::new(DualVca::new()));
    factories.insert("vco".into(), || Box::new(SimpleVco::new()));
    factories.insert("erica_vco3".into(), || Box::new(EricaVco3::new()));
    factories.insert("erica_polivoks_vcf".into(), || Box::new(EricaPolivoksVcf::new()));
    factories.insert("erica_modulator".into(), || Box::new(EricaModulator::new()));
    factories.insert("erica_bassline".into(), || Box::new(EricaBassline::new()));
    factories.insert("erica_bbd".into(), || Box::new(EricaBbd::new()));
    factories.insert("erica_swamp".into(), || Box::new(EricaSwamp::new()));
    factories.insert("fm_clock".into(), || Box::new(Clock::new()));
    factories.insert("fm_offset".into(), || Box::new(OffsetAtten::new()));
    factories.insert("fm_drift".into(), || Box::new(Drift::new()));
    factories.insert("fm_boost".into(), || Box::new(Boost::new()));
    factories.insert("fm_rng".into(), || Box::new(Rng::new()));
    factories.insert("vcf".into(), || Box::new(Vcf::new()));
    factories.insert("noise".into(), || Box::new(Noise::new()));
    factories.insert("facets".into(), || Box::new(Facets::new()));
    factories.insert("lfo".into(), || Box::new(Lfo::new()));
    factories.insert("divider".into(), || Box::new(Divider::new()));
    factories.insert("sequencer".into(), || Box::new(Sequencer::new()));
    factories.insert("sequencer16".into(), || Box::new(Sequencer16::new()));
    factories.insert("sequencer32".into(), || Box::new(Sequencer32::new()));
    factories.insert("sequencer64".into(), || Box::new(Sequencer64::new()));
    factories.insert("sample_hold".into(), || Box::new(SampleHold::new()));
    factories.insert("lots".into(), || Box::new(Lots::new()));
    factories.insert("swell".into(), || Box::new(Swell::new()));
    factories.insert("chimes".into(), || Box::new(Chimes::new()));
    factories.insert("twist".into(), || Box::new(Twist::new()));
    factories.insert("twin".into(), || Box::new(Twin::new()));

    // Deprecated MI product-name aliases (load old patches)
    factories.insert("plaits".into(), || Box::new(Facets::new()));
    factories.insert("marbles".into(), || Box::new(Lots::new()));
    factories.insert("tides".into(), || Box::new(Swell::new()));
    factories.insert("rings".into(), || Box::new(Chimes::new()));
    factories.insert("warps".into(), || Box::new(Twist::new()));
    factories.insert("peaks".into(), || Box::new(Twin::new()));
    factories.insert("seq_switch".into(), || Box::new(SeqSwitch::new()));
    factories.insert("wasp".into(), || Box::new(Wasp::new()));
    factories.insert("ar".into(), || Box::new(Ar::new()));
    factories.insert("adsr".into(), || Box::new(Adsr::new()));
    factories.insert("sampler".into(), || Box::new(Sampler::new()));
    factories.insert("drums".into(), || Box::new(Drums::new()));
    factories.insert("beat".into(), || Box::new(Beat::new()));
    factories.insert("bitboy".into(), || Box::new(Bitboy::new()));
    factories.insert("mult".into(), || Box::new(Mult::new()));
    factories.insert("clk_mult".into(), || Box::new(ClkMult::new()));
    factories.insert("cv_switch".into(), || Box::new(CvSwitch::new()));
    factories.insert("stereo".into(), || Box::new(Stereo::new()));
    factories.insert("delay".into(), || Box::new(Delay::new()));
    factories.insert("reverb".into(), || Box::new(Reverb::new()));
}

pub fn default_graph() -> PatchGraph {
    let mut g = PatchGraph::new();
    let mut map = HashMap::new();
    register_all(&mut map);
    g.register_factories(map);
    g.ensure_speaker(2);
    g
}

pub fn catalog_type_ids() -> &'static [&'static str] {
    &[
        "test_tone",
        "speaker",
        "rc_lpf",
        "erica_mixer",
        "erica_output",
        "midi_cv",
        "midi_cc",
        "midi_pads",
        "polysynth",
        "envelope",
        "dual_vca",
        "vco",
        "erica_vco3",
        "erica_polivoks_vcf",
        "erica_modulator",
        "erica_bassline",
        "erica_bbd",
        "erica_swamp",
        "fm_clock",
        "fm_offset",
        "fm_drift",
        "fm_boost",
        "fm_rng",
        "vcf",
        "noise",
        "facets",
        "lfo",
        "divider",
        "sequencer",
        "sequencer16",
        "sequencer32",
        "sequencer64",
        "sample_hold",
        "lots",
        "swell",
        "chimes",
        "twist",
        "twin",
        "seq_switch",
        "wasp",
        "ar",
        "adsr",
        "sampler",
        "drums",
        "beat",
        "bitboy",
        "mult",
        "clk_mult",
        "cv_switch",
        "stereo",
        "delay",
        "reverb",
    ]
}
