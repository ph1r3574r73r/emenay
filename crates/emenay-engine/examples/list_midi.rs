fn main() {
    println!("=== raw midir ports ===");
    match midir::MidiInput::new("emenay-probe") {
        Ok(midi_in) => {
            let ports = midi_in.ports();
            println!("count={}", ports.len());
            for p in ports {
                match midi_in.port_name(&p) {
                    Ok(n) => println!(
                        "  {}  score={} ignored={}",
                        n,
                        emenay_engine::midi_port_score(&n),
                        emenay_engine::is_ignored_midi_port(&n)
                    ),
                    Err(e) => println!("  <name err {e}>"),
                }
            }
        }
        Err(e) => println!("init failed: {e}"),
    }
    println!("=== list_devices (filtered) ===");
    match emenay_engine::MidiHost::list_devices() {
        Ok(d) => {
            for x in d {
                println!("  {}", x.name);
            }
        }
        Err(e) => println!("err {e}"),
    }
}
