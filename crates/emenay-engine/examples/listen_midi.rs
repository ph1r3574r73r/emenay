//! Live MIDI probe — prints every packet from the Oxygen (or first notes port).
use emenay_engine::{global_midi_bus, MidiHost};
use std::io::{self, Write};
use std::thread;
use std::time::{Duration, Instant};

fn main() {
    let bus = global_midi_bus();
    let prefer = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "Oxygen Pro 25 USB MIDI".into());
    let secs: u64 = std::env::args()
        .nth(2)
        .and_then(|s| s.parse().ok())
        .unwrap_or(40);

    println!("opening `{prefer}` …");
    let host = match MidiHost::start(Some(prefer.clone()), bus.clone()) {
        Ok(h) => h,
        Err(e) => {
            eprintln!("FAIL open `{prefer}`: {e}");
            eprintln!("trying auto…");
            MidiHost::start(None, bus.clone()).expect("no MIDI device")
        }
    };
    println!("OK  primary={}", host.info.name);
    println!("OK  open_ports={:?}", host.open_ports);
    println!();
    println!(">>> Turn knobs / press keys for {secs}s <<<");
    println!();
    let _ = io::stdout().flush();

    let start = Instant::now();
    let mut last = String::new();
    let mut hits = 0u32;
    let mut cc_hits = 0u32;
    let mut note_hits = 0u32;
    let mut raw_hits = 0u32;
    while start.elapsed() < Duration::from_secs(secs) {
        if let Some(msg) = bus.last_midi_message() {
            if msg != last {
                let t = start.elapsed().as_secs_f32();
                println!("[{t:5.1}s] {msg}");
                let _ = io::stdout().flush();
                hits += 1;
                if msg.starts_with("CC") {
                    cc_hits += 1;
                } else if msg.starts_with('N') {
                    note_hits += 1;
                } else if msg.starts_with("raw") {
                    raw_hits += 1;
                }
                last = msg;
            }
        }
        thread::sleep(Duration::from_millis(5));
    }
    println!();
    println!("=== summary ===");
    println!("updates={hits}  CC={cc_hits}  notes={note_hits}  raw={raw_hits}");
    if hits == 0 {
        println!("NOTHING received — host open but silent (wrong mode, wrong port, or no input).");
        std::process::exit(2);
    }
    drop(host);
}
