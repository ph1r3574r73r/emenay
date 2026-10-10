use crate::graph::PatchGraph;
use crate::render_graph;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use thiserror::Error;

thread_local! {
    /// Reused float scratch for non-f32 device formats (no per-callback alloc).
    static RENDER_SCRATCH: RefCell<Vec<f32>> = RefCell::new(Vec::new());
}

#[derive(Debug, Error)]
pub enum HostError {
    #[error("no audio output device")]
    NoDevice,
    #[error("audio device error: {0}")]
    Device(String),
    #[error("stream error: {0}")]
    Stream(String),
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub name: String,
    pub sample_rate: f32,
    pub channels: usize,
    pub buffer_frames: usize,
}

pub struct AudioHost {
    pub info: DeviceInfo,
    stream: cpal::Stream,
    live: Arc<AtomicBool>,
}

// cpal::Stream is !Send on some hosts; we only start/stop from the UI thread.
unsafe impl Send for AudioHost {}
unsafe impl Sync for AudioHost {}

impl AudioHost {
    pub fn list_devices() -> Result<Vec<DeviceInfo>, HostError> {
        let host = cpal::default_host();
        let mut out = Vec::new();
        let devices = host
            .output_devices()
            .map_err(|e| HostError::Device(e.to_string()))?;
        for d in devices {
            let name = d.name().unwrap_or_else(|_| "unknown".into());
            let cfg = d
                .default_output_config()
                .map_err(|e| HostError::Device(e.to_string()))?;
            out.push(DeviceInfo {
                name,
                sample_rate: cfg.sample_rate().0 as f32,
                channels: cfg.channels() as usize,
                buffer_frames: 0,
            });
        }
        Ok(out)
    }

    pub fn start(
        device_name: Option<String>,
        graph: Arc<Mutex<PatchGraph>>,
        live: Arc<AtomicBool>,
    ) -> Result<Self, HostError> {
        let host = cpal::default_host();
        let device = if let Some(name) = device_name {
            host.output_devices()
                .map_err(|e| HostError::Device(e.to_string()))?
                .find(|d| d.name().ok().as_deref() == Some(name.as_str()))
                .ok_or(HostError::NoDevice)?
        } else {
            host.default_output_device().ok_or(HostError::NoDevice)?
        };

        let default = device
            .default_output_config()
            .map_err(|e| HostError::Device(e.to_string()))?;
        // MI hosts (Facets/Chimes/…) are compiled for 48 kHz — prefer that over
        // the device default (often 44.1 kHz) when the hardware allows it.
        let (sample_format, stream_config) = prefer_mi_sample_rate(&device, default)?;
        let sample_rate = stream_config.sample_rate.0 as f32;
        let channels = stream_config.channels as usize;
        let name = device.name().unwrap_or_else(|_| "default".into());

        live.store(true, Ordering::SeqCst);

        let stream = match sample_format {
            cpal::SampleFormat::F32 => {
                // Native f32: render straight into the device buffer (no scratch/copy).
                build_stream_f32(&device, &stream_config, graph, Arc::clone(&live))?
            }
            cpal::SampleFormat::I16 => {
                build_stream_convert::<i16>(&device, &stream_config, graph, Arc::clone(&live))?
            }
            cpal::SampleFormat::U16 => {
                build_stream_convert::<u16>(&device, &stream_config, graph, Arc::clone(&live))?
            }
            other => {
                return Err(HostError::Stream(format!(
                    "unsupported sample format: {other:?}"
                )))
            }
        };
        stream
            .play()
            .map_err(|e| HostError::Stream(e.to_string()))?;

        Ok(Self {
            info: DeviceInfo {
                name,
                sample_rate,
                channels,
                buffer_frames: 0,
            },
            stream,
            live,
        })
    }

    pub fn stop(self) {
        // Gate the callback first so the next buffer is silence even before drop.
        self.live.store(false, Ordering::SeqCst);
        let _ = self.stream.pause();
        drop(self.stream);
    }
}

/// Target rate for Mutable Instruments DSP hosts.
const MI_SR: u32 = 48_000;

/// Pick a stream config at 48 kHz when supported (same format/channels as default).
fn prefer_mi_sample_rate(
    device: &cpal::Device,
    default: cpal::SupportedStreamConfig,
) -> Result<(cpal::SampleFormat, cpal::StreamConfig), HostError> {
    let sample_format = default.sample_format();
    let mut config: cpal::StreamConfig = default.clone().into();

    if config.sample_rate.0 == MI_SR {
        return Ok((sample_format, config));
    }

    let supported = device
        .supported_output_configs()
        .map_err(|e| HostError::Device(e.to_string()))?;

    for range in supported {
        if range.sample_format() != sample_format {
            continue;
        }
        if range.channels() != default.channels() {
            continue;
        }
        if range.min_sample_rate().0 <= MI_SR && range.max_sample_rate().0 >= MI_SR {
            config = range
                .with_sample_rate(cpal::SampleRate(MI_SR))
                .into();
            return Ok((sample_format, config));
        }
    }

    // Hardware won't do 48 kHz — keep device default (MI pitches will be off).
    Ok((sample_format, config))
}

fn build_stream_f32(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    graph: Arc<Mutex<PatchGraph>>,
    live: Arc<AtomicBool>,
) -> Result<cpal::Stream, HostError> {
    let channels = config.channels as usize;
    let err_fn = |e| eprintln!("emenay audio stream error: {e}");
    device
        .build_output_stream(
            config,
            move |data: &mut [f32], _| {
                if !live.load(Ordering::Relaxed) {
                    data.fill(0.0);
                    return;
                }
                data.fill(0.0);
                render_graph(&graph, data, channels);
            },
            err_fn,
            None,
        )
        .map_err(|e| HostError::Stream(e.to_string()))
}

fn build_stream_convert<T>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    graph: Arc<Mutex<PatchGraph>>,
    live: Arc<AtomicBool>,
) -> Result<cpal::Stream, HostError>
where
    T: cpal::SizedSample + cpal::FromSample<f32>,
{
    let channels = config.channels as usize;
    let err_fn = |e| eprintln!("emenay audio stream error: {e}");
    device
        .build_output_stream(
            config,
            move |data: &mut [T], _| {
                if !live.load(Ordering::Relaxed) {
                    for o in data.iter_mut() {
                        *o = T::from_sample(0.0);
                    }
                    return;
                }
                RENDER_SCRATCH.with(|cell| {
                    let mut scratch = cell.borrow_mut();
                    if scratch.len() < data.len() {
                        scratch.resize(data.len(), 0.0);
                    }
                    let buf = &mut scratch[..data.len()];
                    buf.fill(0.0);
                    render_graph(&graph, buf, channels);
                    for (o, s) in data.iter_mut().zip(buf.iter()) {
                        *o = T::from_sample(*s);
                    }
                });
            },
            err_fn,
            None,
        )
        .map_err(|e| HostError::Stream(e.to_string()))
}
