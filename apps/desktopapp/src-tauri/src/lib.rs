use serde::Serialize;
use std::collections::hash_map::DefaultHasher;
use std::fs::{self, File};
use std::hash::{Hash, Hasher};
use std::path::Path;
use std::process::Command;
use std::time::{Duration, SystemTime};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            analyzer_health,
            inspect_media_playback,
            prepare_media_preview_clip,
            open_media_in_quicktime
        ])
        .run(tauri::generate_context!())
        .expect("failed to run vaexcore pulse desktop shell");
}

#[tauri::command]
fn analyzer_health() -> &'static str {
    "analyzer bridge pending"
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MediaPlaybackInspection {
    path_exists: bool,
    readable: bool,
    file_size_bytes: Option<u64>,
    ffprobe_available: bool,
    probe_succeeded: bool,
    format_name: Option<String>,
    video_codec: Option<String>,
    audio_codec: Option<String>,
    detail: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PreparedMediaPreview {
    preview_path: String,
    reused_existing: bool,
    file_size_bytes: Option<u64>,
    duration_seconds: f64,
    detail: String,
}

#[tauri::command]
fn inspect_media_playback(media_path: String) -> Result<MediaPlaybackInspection, String> {
    let path = Path::new(&media_path);
    if !path.exists() {
        return Ok(MediaPlaybackInspection {
            path_exists: false,
            readable: false,
            file_size_bytes: None,
            ffprobe_available: false,
            probe_succeeded: false,
            format_name: None,
            video_codec: None,
            audio_codec: None,
            detail: format!(
                "The saved file path no longer exists on disk: {}",
                media_path
            ),
        });
    }

    let metadata = std::fs::metadata(path).map_err(|error| error.to_string())?;
    let readable = File::open(path).is_ok();
    if !readable {
        return Ok(MediaPlaybackInspection {
            path_exists: true,
            readable: false,
            file_size_bytes: Some(metadata.len()),
            ffprobe_available: false,
            probe_succeeded: false,
            format_name: None,
            video_codec: None,
            audio_codec: None,
            detail: format!(
                "vaexcore pulse can still see the file path, but macOS did not allow the app to read it: {}",
                media_path
            ),
        });
    }

    let ffprobe_output = Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-show_entries",
            "format=format_name",
            "-show_entries",
            "stream=codec_type,codec_name",
            "-of",
            "json",
            &media_path,
        ])
        .output();

    let output = match ffprobe_output {
        Ok(output) => output,
        Err(error) => {
            let detail = if error.kind() == std::io::ErrorKind::NotFound {
                "The file exists, but ffprobe is not installed, so VCP could not inspect the media stream details.".to_string()
            } else {
                format!(
                    "The file exists, but VCP could not run ffprobe to inspect it: {}",
                    error
                )
            };

            return Ok(MediaPlaybackInspection {
                path_exists: true,
                readable,
                file_size_bytes: Some(metadata.len()),
                ffprobe_available: false,
                probe_succeeded: false,
                format_name: None,
                video_codec: None,
                audio_codec: None,
                detail,
            });
        }
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Ok(MediaPlaybackInspection {
            path_exists: true,
            readable,
            file_size_bytes: Some(metadata.len()),
            ffprobe_available: true,
            probe_succeeded: false,
            format_name: None,
            video_codec: None,
            audio_codec: None,
            detail: if stderr.is_empty() {
                "The file exists, but ffprobe could not read it as valid media.".to_string()
            } else {
                format!("The file exists, but ffprobe could not read it as valid media: {}", stderr)
            },
        });
    }

    let parsed = serde_json::from_slice::<serde_json::Value>(&output.stdout)
        .map_err(|error| error.to_string())?;
    let streams = parsed
        .get("streams")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();
    let format_name = parsed
        .get("format")
        .and_then(|value| value.get("format_name"))
        .and_then(|value| value.as_str())
        .map(ToOwned::to_owned);
    let video_codec = streams
        .iter()
        .find(|stream| {
            stream
                .get("codec_type")
                .and_then(|value| value.as_str())
                == Some("video")
        })
        .and_then(|stream| stream.get("codec_name"))
        .and_then(|value| value.as_str())
        .map(ToOwned::to_owned);
    let audio_codec = streams
        .iter()
        .find(|stream| {
            stream
                .get("codec_type")
                .and_then(|value| value.as_str())
                == Some("audio")
        })
        .and_then(|stream| stream.get("codec_name"))
        .and_then(|value| value.as_str())
        .map(ToOwned::to_owned);

    let detail = match (video_codec.as_deref(), audio_codec.as_deref()) {
        (Some("h264"), Some("aac")) => "The file exists and ffprobe read it successfully as a standard H.264/AAC MP4. Since the embedded preview still failed, this points to the desktop webview playback path rather than a bad export.".to_string(),
        (Some(video), Some(audio)) => format!(
            "The file exists and ffprobe read it successfully (video {}, audio {}). The embedded preview may not support this playback path or codec combination.",
            video, audio
        ),
        (Some(video), None) => format!(
            "The file exists and ffprobe read it successfully (video {}). The embedded preview may not support this playback path or missing audio stream.",
            video
        ),
        _ => "The file exists and ffprobe could read it, but VCP could not identify a normal video/audio stream combination for the embedded player.".to_string(),
    };

    Ok(MediaPlaybackInspection {
        path_exists: true,
        readable,
        file_size_bytes: Some(metadata.len()),
        ffprobe_available: true,
        probe_succeeded: true,
        format_name,
        video_codec,
        audio_codec,
        detail,
    })
}

#[tauri::command]
fn prepare_media_preview_clip(
    media_path: String,
    start_seconds: f64,
    end_seconds: f64,
) -> Result<PreparedMediaPreview, String> {
    let path = Path::new(&media_path);
    if !path.exists() {
        return Err(format!("File not found: {}", media_path));
    }

    if File::open(path).is_err() {
        return Err(format!(
            "vaexcore pulse could not read this local file to prepare an in-app preview clip: {}",
            media_path
        ));
    }

    match Command::new("ffmpeg").arg("-version").output() {
        Ok(output) if output.status.success() => {}
        Ok(_) => {
            return Err(
                "vaexcore pulse could not verify ffmpeg, so it cannot prepare an in-app preview clip."
                    .to_string(),
            )
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err(
                "vaexcore pulse needs ffmpeg installed locally to prepare in-app preview clips."
                    .to_string(),
            )
        }
        Err(error) => {
            return Err(format!(
                "vaexcore pulse could not start ffmpeg to prepare this preview clip: {}",
                error
            ))
        }
    }

    let normalized_start_seconds = start_seconds.max(0.0);
    let normalized_end_seconds = end_seconds.max(normalized_start_seconds + 0.2);
    let clip_duration_seconds = (normalized_end_seconds - normalized_start_seconds).max(0.2);
    let cache_dir = preview_cache_dir();
    fs::create_dir_all(&cache_dir).map_err(|error| error.to_string())?;
    cleanup_old_preview_clips(&cache_dir);

    let metadata = fs::metadata(path).map_err(|error| error.to_string())?;
    let modified_epoch_seconds = metadata
        .modified()
        .ok()
        .and_then(|modified| modified.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs())
        .unwrap_or(0);

    let mut hasher = DefaultHasher::new();
    media_path.hash(&mut hasher);
    metadata.len().hash(&mut hasher);
    modified_epoch_seconds.hash(&mut hasher);
    format!(
        "{:.3}:{:.3}",
        normalized_start_seconds, normalized_end_seconds
    )
    .hash(&mut hasher);

    let cache_key = hasher.finish();
    let preview_stem = sanitize_file_stem(
        path.file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or("moment-preview"),
    );
    let preview_path = cache_dir.join(format!(
        "{}-{:016x}.mp4",
        preview_stem, cache_key
    ));

    if preview_path.exists() {
        let existing_metadata = fs::metadata(&preview_path).map_err(|error| error.to_string())?;
        if existing_metadata.len() > 0 {
            return Ok(PreparedMediaPreview {
                preview_path: preview_path.to_string_lossy().to_string(),
                reused_existing: true,
                file_size_bytes: Some(existing_metadata.len()),
                duration_seconds: clip_duration_seconds,
                detail:
                    "VCP reused a cached in-app preview clip for this moment.".to_string(),
            });
        }

        let _ = fs::remove_file(&preview_path);
    }

    let ffmpeg_output = Command::new("ffmpeg")
        .args([
            "-v",
            "error",
            "-nostdin",
            "-y",
            "-ss",
            &format!("{:.3}", normalized_start_seconds),
            "-t",
            &format!("{:.3}", clip_duration_seconds),
            "-i",
            &media_path,
            "-map",
            "0:v:0?",
            "-map",
            "0:a:0?",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "30",
            "-vf",
            "scale=1280:-2:force_original_aspect_ratio=decrease,fps=30",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "96k",
            "-ac",
            "2",
            "-movflags",
            "+faststart",
            preview_path
                .to_str()
                .ok_or_else(|| "VCP could not resolve a preview clip path.".to_string())?,
        ])
        .output()
        .map_err(|error| {
            format!(
                "vaexcore pulse could not run ffmpeg to prepare this preview clip: {}",
                error
            )
        })?;

    if !ffmpeg_output.status.success() {
        let _ = fs::remove_file(&preview_path);
        let stderr = String::from_utf8_lossy(&ffmpeg_output.stderr)
            .trim()
            .to_string();
        if stderr.is_empty() {
            return Err(
                "vaexcore pulse could not generate an in-app preview clip for this moment."
                    .to_string(),
            );
        }

        return Err(format!(
            "vaexcore pulse could not generate an in-app preview clip for this moment: {}",
            stderr
        ));
    }

    let preview_metadata = fs::metadata(&preview_path).map_err(|error| error.to_string())?;

    Ok(PreparedMediaPreview {
        preview_path: preview_path.to_string_lossy().to_string(),
        reused_existing: false,
        file_size_bytes: Some(preview_metadata.len()),
        duration_seconds: clip_duration_seconds,
        detail: "VCP prepared a temporary in-app preview clip for this moment."
            .to_string(),
    })
}

#[tauri::command]
fn open_media_in_quicktime(media_path: String, start_seconds: Option<f64>) -> Result<String, String> {
    if !Path::new(&media_path).exists() {
        return Err(format!("File not found: {}", media_path));
    }

    let normalized_seconds = start_seconds.unwrap_or(0.0).max(0.0);
    let escaped_path = media_path
        .replace('\\', "\\\\")
        .replace('"', "\\\"");
    let apple_script = format!(
        r#"
set targetFile to POSIX file "{escaped_path}"
set targetTime to {normalized_seconds}
tell application "QuickTime Player"
  activate
  open targetFile
  repeat 50 times
    try
      set current time of front document to targetTime
      exit repeat
    on error
      delay 0.1
    end try
  end repeat
end tell
"#,
    );

    let script_status = Command::new("osascript")
        .arg("-e")
        .arg(apple_script)
        .output();

    match script_status {
        Ok(output) if output.status.success() => Ok(
            "Opened this file in QuickTime and jumped to the requested moment."
                .to_string(),
        ),
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let fallback = Command::new("open")
                .args(["-a", "QuickTime Player", &media_path])
                .status()
                .map_err(|error| error.to_string())?;
            if fallback.success() {
                if stderr.is_empty() {
                    Ok("Opened this file in QuickTime, but VCP could not jump to the exact timestamp automatically.".to_string())
                } else {
                    Ok(format!(
                        "Opened this file in QuickTime, but VCP could not jump to the exact timestamp automatically: {}",
                        stderr
                    ))
                }
            } else {
                Err("VCP could not launch QuickTime for this file.".to_string())
            }
        }
        Err(error) => Err(format!(
            "VCP could not launch the QuickTime fallback: {}",
            error
        )),
    }
}

fn cleanup_old_preview_clips(cache_dir: &Path) {
    let expire_before = SystemTime::now()
        .checked_sub(Duration::from_secs(60 * 60 * 24 * 3))
        .unwrap_or(SystemTime::UNIX_EPOCH);
    let max_cache_bytes: u64 = 512 * 1024 * 1024;
    let max_cache_files: usize = 24;

    let entries = match fs::read_dir(cache_dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    let mut retained_entries = Vec::new();
    for entry in entries.flatten() {
        let preview_path = entry.path();
        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        let modified_time = match metadata.modified() {
            Ok(modified_time) => modified_time,
            Err(_) => continue,
        };

        if modified_time < expire_before {
            let _ = fs::remove_file(preview_path);
            continue;
        }

        retained_entries.push((preview_path, metadata.len(), modified_time));
    }

    retained_entries.sort_by_key(|(_, _, modified_time)| *modified_time);

    let mut total_bytes = retained_entries
        .iter()
        .fold(0_u64, |sum, (_, size_bytes, _)| sum.saturating_add(*size_bytes));
    let mut total_files = retained_entries.len();

    for (preview_path, size_bytes, _) in retained_entries {
        if total_bytes <= max_cache_bytes && total_files <= max_cache_files {
            break;
        }

        if fs::remove_file(&preview_path).is_ok() {
            total_bytes = total_bytes.saturating_sub(size_bytes);
            total_files = total_files.saturating_sub(1);
        }
    }
}

fn preview_cache_dir() -> std::path::PathBuf {
    std::env::temp_dir().join("vaexcore-pulse-preview-clips")
}

fn sanitize_file_stem(file_stem: &str) -> String {
    let sanitized = file_stem
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character
            } else {
                '-'
            }
        })
        .collect::<String>();

    let trimmed = sanitized.trim_matches('-');
    if trimmed.is_empty() {
        "moment-preview".to_string()
    } else {
        trimmed.to_string()
    }
}
