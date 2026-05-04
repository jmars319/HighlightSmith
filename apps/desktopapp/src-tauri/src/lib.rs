use serde::Serialize;
use std::collections::hash_map::DefaultHasher;
use std::env;
use std::fs::{self, File};
use std::hash::{Hash, Hasher};
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu, WINDOW_SUBMENU_ID};
use tauri::{Emitter, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};

const APP_NAME: &str = "vaexcore pulse";
const MAIN_WINDOW_LABEL: &str = "main";
const SETTINGS_WINDOW_LABEL: &str = "settings";
const MENU_OPEN_SETTINGS: &str = "open-settings";
const MENU_OPEN_PROFILE_SETUP: &str = "open-profile-setup";
const MENU_SHOW_MAIN: &str = "show-main-window";
const MENU_CLOSE_MAIN: &str = "close-main-window";
const MENU_CLOSE_MAIN_FILE: &str = "close-main-window-file";
const MENU_QUIT_APP: &str = "quit-app";
const MENU_LAUNCH_SUITE: &str = "launch-suite";
const ANALYZER_PORT: u16 = 9010;
const API_PORT: u16 = 4010;
const VAEXCORE_SUITE_APPS: &[&str] = &["vaexcore studio", "vaexcore pulse", "vaexcore console"];
const SUITE_DISCOVERY_SCHEMA_VERSION: u8 = 1;
const SUITE_DISCOVERY_HEARTBEAT_INTERVAL: Duration = Duration::from_secs(15);

#[derive(Default)]
struct ManagedLocalServices {
    analyzer: Option<Child>,
    api: Option<Child>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SuiteLaunchResult {
    app_name: String,
    ok: bool,
    detail: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SuiteDiscoveryDocument {
    schema_version: u8,
    app_id: String,
    app_name: String,
    bundle_identifier: String,
    version: String,
    pid: u32,
    started_at: String,
    updated_at: String,
    api_url: Option<String>,
    ws_url: Option<String>,
    health_url: Option<String>,
    capabilities: Vec<String>,
    launch_name: String,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Mutex::new(ManagedLocalServices::default()))
        .setup(|app| {
            let app_handle = app.handle().clone();
            thread::spawn(move || match ensure_local_services(&app_handle) {
                Ok(()) => start_suite_discovery_heartbeat(),
                Err(error) => {
                    eprintln!("Unable to start vaexcore pulse local services: {error}");
                }
            });
            Ok(())
        })
        .menu(build_app_menu)
        .on_menu_event(|app, event| {
            if event.id() == MENU_OPEN_SETTINGS {
                let _ = open_settings_window_for(app, None);
            } else if event.id() == MENU_OPEN_PROFILE_SETUP {
                let _ = open_settings_window_for(app, Some("profile-setup"));
            } else if event.id() == MENU_SHOW_MAIN {
                let _ = show_main_window(app);
            } else if event.id() == MENU_CLOSE_MAIN || event.id() == MENU_CLOSE_MAIN_FILE {
                let _ = close_main_window(app);
            } else if event.id() == MENU_QUIT_APP {
                stop_local_services(app);
                app.exit(0);
            } else if event.id() == MENU_LAUNCH_SUITE {
                thread::spawn(|| {
                    for result in launch_vaexcore_suite() {
                        if !result.ok {
                            eprintln!(
                                "Unable to launch {} from vaexcore suite: {}",
                                result.app_name, result.detail
                            );
                        }
                    }
                });
            }
        })
        .on_window_event(|window, event| {
            if window.label() == MAIN_WINDOW_LABEL {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            analyzer_health,
            studio_api_discovery,
            inspect_media_playback,
            prepare_media_preview_clip,
            open_media_in_quicktime,
            open_settings_window,
            launch_vaexcore_suite
        ])
        .build(tauri::generate_context!())
        .expect("failed to build vaexcore pulse desktop shell");

    app.run(|app_handle, event| match event {
        tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
            stop_local_services(app_handle);
        }
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Reopen {
            has_visible_windows: false,
            ..
        } => {
            let _ = show_main_window(app_handle);
        }
        _ => {}
    });
}

fn build_app_menu<R: Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<Menu<R>> {
    let package_info = app.package_info();
    let config = app.config();
    let about_metadata = AboutMetadata {
        name: Some(APP_NAME.to_string()),
        version: Some(package_info.version.to_string()),
        copyright: config.bundle.copyright.clone(),
        authors: config
            .bundle
            .publisher
            .clone()
            .map(|publisher| vec![publisher]),
        ..Default::default()
    };

    let window_menu = Submenu::with_id_and_items(
        app,
        WINDOW_SUBMENU_ID,
        "Window",
        true,
        &[
            &MenuItem::with_id(app, MENU_SHOW_MAIN, "Show Main Window", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            #[cfg(target_os = "macos")]
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::show_all(app, None)?,
        ],
    )?;

    Menu::with_items(
        app,
        &[
            #[cfg(target_os = "macos")]
            &Submenu::with_items(
                app,
                APP_NAME,
                true,
                &[
                    &PredefinedMenuItem::about(app, None, Some(about_metadata))?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(
                        app,
                        MENU_OPEN_SETTINGS,
                        "Settings...",
                        true,
                        Some("CmdOrCtrl+Comma"),
                    )?,
                    &MenuItem::with_id(
                        app,
                        MENU_OPEN_PROFILE_SETUP,
                        "Profile Setup...",
                        true,
                        None::<&str>,
                    )?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(
                        app,
                        MENU_LAUNCH_SUITE,
                        "Launch vaexcore Suite",
                        true,
                        None::<&str>,
                    )?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(
                        app,
                        MENU_SHOW_MAIN,
                        "Show Main Window",
                        true,
                        None::<&str>,
                    )?,
                    &MenuItem::with_id(
                        app,
                        MENU_CLOSE_MAIN,
                        "Close Main Window (Pulse Keeps Running)",
                        true,
                        Some("CmdOrCtrl+W"),
                    )?,
                    &MenuItem::with_id(
                        app,
                        MENU_QUIT_APP,
                        "Quit vaexcore pulse (Stops Background Work)",
                        true,
                        Some("CmdOrCtrl+Q"),
                    )?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::services(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::hide(app, None)?,
                    &PredefinedMenuItem::hide_others(app, None)?,
                    &PredefinedMenuItem::show_all(app, None)?,
                ],
            )?,
            #[cfg(not(any(
                target_os = "macos",
                target_os = "linux",
                target_os = "dragonfly",
                target_os = "freebsd",
                target_os = "netbsd",
                target_os = "openbsd"
            )))]
            &Submenu::with_items(
                app,
                "File",
                true,
                &[
                    &MenuItem::with_id(app, MENU_OPEN_SETTINGS, "Settings...", true, None::<&str>)?,
                    &MenuItem::with_id(
                        app,
                        MENU_OPEN_PROFILE_SETUP,
                        "Profile Setup...",
                        true,
                        None::<&str>,
                    )?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(
                        app,
                        MENU_LAUNCH_SUITE,
                        "Launch vaexcore Suite",
                        true,
                        None::<&str>,
                    )?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(
                        app,
                        MENU_CLOSE_MAIN_FILE,
                        "Close Main Window (Pulse Keeps Running)",
                        true,
                        None::<&str>,
                    )?,
                    #[cfg(not(target_os = "macos"))]
                    &MenuItem::with_id(
                        app,
                        MENU_QUIT_APP,
                        "Quit vaexcore pulse (Stops Background Work)",
                        true,
                        Some("CmdOrCtrl+Q"),
                    )?,
                ],
            )?,
            &Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(app, None)?,
                    &PredefinedMenuItem::redo(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, None)?,
                    &PredefinedMenuItem::copy(app, None)?,
                    &PredefinedMenuItem::paste(app, None)?,
                    &PredefinedMenuItem::select_all(app, None)?,
                ],
            )?,
            #[cfg(target_os = "macos")]
            &Submenu::with_items(
                app,
                "View",
                true,
                &[&PredefinedMenuItem::fullscreen(app, None)?],
            )?,
            &window_menu,
        ],
    )
}

#[tauri::command]
fn open_settings_window(app: tauri::AppHandle, section: Option<String>) -> Result<(), String> {
    open_settings_window_for(&app, section.as_deref())
}

#[tauri::command]
fn launch_vaexcore_suite() -> Vec<SuiteLaunchResult> {
    VAEXCORE_SUITE_APPS
        .iter()
        .map(|app_name| launch_macos_app(app_name))
        .collect()
}

fn launch_macos_app(app_name: &str) -> SuiteLaunchResult {
    #[cfg(target_os = "macos")]
    {
        match Command::new("open").args(["-a", app_name]).output() {
            Ok(output) if output.status.success() => SuiteLaunchResult {
                app_name: app_name.to_string(),
                ok: true,
                detail: "Launch requested.".to_string(),
            },
            Ok(output) => {
                let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
                SuiteLaunchResult {
                    app_name: app_name.to_string(),
                    ok: false,
                    detail: if detail.is_empty() {
                        format!("open exited with status {}.", output.status)
                    } else {
                        detail
                    },
                }
            }
            Err(error) => SuiteLaunchResult {
                app_name: app_name.to_string(),
                ok: false,
                detail: error.to_string(),
            },
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        SuiteLaunchResult {
            app_name: app_name.to_string(),
            ok: false,
            detail: "Launch Suite is only implemented for macOS Applications.".to_string(),
        }
    }
}

fn start_suite_discovery_heartbeat() {
    let started_at = suite_timestamp();

    thread::spawn(move || loop {
        let api_url = format!("http://127.0.0.1:{API_PORT}");
        let document = SuiteDiscoveryDocument {
            schema_version: SUITE_DISCOVERY_SCHEMA_VERSION,
            app_id: "vaexcore-pulse".to_string(),
            app_name: APP_NAME.to_string(),
            bundle_identifier: "com.vaexil.vaexcore.pulse".to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            pid: std::process::id(),
            started_at: started_at.clone(),
            updated_at: suite_timestamp(),
            api_url: Some(api_url.clone()),
            ws_url: None,
            health_url: Some(format!("{api_url}/health")),
            capabilities: vec![
                "pulse.api".to_string(),
                "highlight.review".to_string(),
                "studio.recording.intake".to_string(),
                "suite.launcher".to_string(),
            ],
            launch_name: APP_NAME.to_string(),
        };

        if let Err(error) = write_suite_discovery_document(&document) {
            eprintln!("Unable to write vaexcore pulse suite discovery: {error}");
        }

        thread::sleep(SUITE_DISCOVERY_HEARTBEAT_INTERVAL);
    });
}

fn write_suite_discovery_document(document: &SuiteDiscoveryDocument) -> std::io::Result<()> {
    let directory = suite_discovery_dir();
    fs::create_dir_all(&directory)?;
    let path = directory.join(format!("{}.json", document.app_id));
    let serialized = serde_json::to_vec_pretty(document)?;
    fs::write(path, serialized)
}

fn suite_discovery_dir() -> PathBuf {
    env::var("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("Library")
        .join("Application Support")
        .join("vaexcore")
        .join("suite")
}

fn suite_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn open_settings_window_for<R: Runtime>(
    app: &tauri::AppHandle<R>,
    section: Option<&str>,
) -> Result<(), String> {
    let section = normalize_settings_section(section);

    if let Some(window) = app.get_webview_window(SETTINGS_WINDOW_LABEL) {
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        if let Some(section) = section {
            window
                .emit("settings-section-selected", section)
                .map_err(|error| error.to_string())?;
        }
        return Ok(());
    }

    let settings_url = match section {
        Some(section) => format!("index.html?window=settings&section={section}"),
        None => "index.html?window=settings".to_string(),
    };

    WebviewWindowBuilder::new(
        app,
        SETTINGS_WINDOW_LABEL,
        WebviewUrl::App(settings_url.into()),
    )
    .title("vaexcore pulse Settings")
    .inner_size(760.0, 660.0)
    .min_inner_size(560.0, 500.0)
    .resizable(true)
    .center()
    .build()
    .map_err(|error| error.to_string())?;

    Ok(())
}

fn normalize_settings_section(section: Option<&str>) -> Option<&'static str> {
    match section {
        Some("profile-setup") => Some("profile-setup"),
        Some("appearance") => Some("appearance"),
        Some("window-behavior") => Some("window-behavior"),
        _ => None,
    }
}

fn ensure_local_services<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<(), String> {
    let repo_root = resolve_repo_root()?;

    if !port_is_open(ANALYZER_PORT) {
        let analyzer = spawn_analyzer(&repo_root)?;
        app.state::<Mutex<ManagedLocalServices>>()
            .lock()
            .map_err(|_| "Unable to track analyzer process.".to_string())?
            .analyzer = Some(analyzer);
        wait_for_port("Analyzer", ANALYZER_PORT, Duration::from_secs(30))?;
    }

    if !port_is_open(API_PORT) {
        let api = spawn_api_bridge(&repo_root)?;
        app.state::<Mutex<ManagedLocalServices>>()
            .lock()
            .map_err(|_| "Unable to track API bridge process.".to_string())?
            .api = Some(api);
        wait_for_port("API bridge", API_PORT, Duration::from_secs(30))?;
    }

    Ok(())
}

fn stop_local_services<R: Runtime>(app: &tauri::AppHandle<R>) {
    let service_state = app.state::<Mutex<ManagedLocalServices>>();
    let Ok(mut services) = service_state.lock() else {
        return;
    };

    if let Some(mut api) = services.api.take() {
        let _ = api.kill();
        let _ = api.wait();
    }

    if let Some(mut analyzer) = services.analyzer.take() {
        let _ = analyzer.kill();
        let _ = analyzer.wait();
    }
}

fn spawn_analyzer(repo_root: &Path) -> Result<Child, String> {
    let python = find_executable(
        "python3",
        &[
            "/opt/homebrew/bin/python3",
            "/usr/local/bin/python3",
            "/usr/bin/python3",
        ],
    )
    .ok_or_else(|| "python3 is required to start the local analyzer.".to_string())?;
    let python_path = repo_root.join("services/analyzer/src");

    Command::new(python)
        .current_dir(repo_root)
        .env("PYTHONPATH", python_path)
        .env("PATH", command_path())
        .arg("-m")
        .arg("vaexcore_pulse_analyzer.server")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Failed to start the local analyzer: {error}"))
}

fn spawn_api_bridge(repo_root: &Path) -> Result<Child, String> {
    let pnpm = find_executable(
        "pnpm",
        &[
            "/opt/homebrew/bin/pnpm",
            "/usr/local/bin/pnpm",
            "/usr/bin/pnpm",
        ],
    )
    .ok_or_else(|| "pnpm is required to start the local API bridge.".to_string())?;

    Command::new(pnpm)
        .current_dir(repo_root)
        .env("PATH", command_path())
        .env(
            "VAEXCORE_PULSE_ANALYZER_URL",
            format!("http://127.0.0.1:{ANALYZER_PORT}"),
        )
        .arg("--filter")
        .arg("@vaexcore/pulse-api")
        .arg("start")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Failed to start the local API bridge: {error}"))
}

fn resolve_repo_root() -> Result<PathBuf, String> {
    if let Ok(configured_root) = env::var("VAEXCORE_PULSE_REPO_ROOT") {
        let path = PathBuf::from(configured_root);
        if path.join("services/api/package.json").exists() {
            return Ok(path);
        }
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let repo_root = manifest_dir
        .parent()
        .and_then(Path::parent)
        .and_then(Path::parent)
        .ok_or_else(|| "Unable to locate the vaexcore pulse repository.".to_string())?
        .to_path_buf();

    if repo_root.join("services/api/package.json").exists()
        && repo_root.join("services/analyzer/src").exists()
    {
        return Ok(repo_root);
    }

    Err("Pulse could not find the helper files it needs to start.".to_string())
}

fn find_executable(name: &str, fallback_paths: &[&str]) -> Option<PathBuf> {
    if let Some(paths) = env::var_os("PATH") {
        for directory in env::split_paths(&paths) {
            let candidate = directory.join(name);
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    fallback_paths
        .iter()
        .map(PathBuf::from)
        .find(|candidate| candidate.exists())
}

fn command_path() -> String {
    let current_path = env::var("PATH").unwrap_or_default();
    format!("/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:{current_path}")
}

fn port_is_open(port: u16) -> bool {
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    TcpStream::connect_timeout(&address, Duration::from_millis(250)).is_ok()
}

fn wait_for_port(service_name: &str, port: u16, timeout: Duration) -> Result<(), String> {
    let started_at = SystemTime::now();

    loop {
        if port_is_open(port) {
            return Ok(());
        }

        if started_at
            .elapsed()
            .unwrap_or_else(|_| Duration::from_secs(0))
            >= timeout
        {
            return Err(format!(
                "{service_name} is still starting. Try again in a few seconds."
            ));
        }

        thread::sleep(Duration::from_millis(300));
    }
}

fn show_main_window<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<(), String> {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return Err("The main vaexcore pulse window is not available.".to_string());
    };

    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

fn close_main_window<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<(), String> {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return Err("The main vaexcore pulse window is not available.".to_string());
    };

    window.hide().map_err(|error| error.to_string())
}

#[tauri::command]
fn analyzer_health() -> &'static str {
    "analyzer bridge pending"
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StudioApiDiscovery {
    api_url: String,
    ws_url: String,
    token: Option<String>,
    discovered: bool,
    source: String,
    detail: String,
}

#[tauri::command]
fn studio_api_discovery() -> StudioApiDiscovery {
    let configured_api_url = env::var("VAEXCORE_STUDIO_API_URL")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let configured_ws_url = env::var("VAEXCORE_STUDIO_WS_URL")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let token = env::var("VAEXCORE_STUDIO_API_TOKEN")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    if let Some(api_url) = configured_api_url {
        let ws_url = configured_ws_url.unwrap_or_else(|| ws_url_from_api_url(&api_url));
        return StudioApiDiscovery {
            api_url,
            ws_url,
            token,
            discovered: true,
            source: "env".to_string(),
            detail: "Using VAEXCORE_STUDIO_API_URL.".to_string(),
        };
    }

    let discovery_path = studio_discovery_file_path();
    if let Ok(raw) = fs::read_to_string(&discovery_path) {
        if let Ok(document) = serde_json::from_str::<serde_json::Value>(&raw) {
            let api_url = document
                .get("apiUrl")
                .or_else(|| document.get("api_url"))
                .and_then(|value| value.as_str())
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned);
            let ws_url = document
                .get("wsUrl")
                .or_else(|| document.get("ws_url"))
                .and_then(|value| value.as_str())
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned);

            if let Some(api_url) = api_url {
                return StudioApiDiscovery {
                    ws_url: configured_ws_url
                        .unwrap_or_else(|| ws_url.unwrap_or_else(|| ws_url_from_api_url(&api_url))),
                    api_url,
                    token,
                    discovered: true,
                    source: "discovery_file".to_string(),
                    detail: format!("Loaded {}.", discovery_path.display()),
                };
            }
        }
    }

    let api_url = "http://127.0.0.1:51287".to_string();
    StudioApiDiscovery {
        ws_url: configured_ws_url.unwrap_or_else(|| ws_url_from_api_url(&api_url)),
        api_url,
        token,
        discovered: false,
        source: "default".to_string(),
        detail: "Studio discovery file was not found; using the default localhost URL.".to_string(),
    }
}

fn studio_discovery_file_path() -> PathBuf {
    let home = env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home)
        .join("Library")
        .join("Application Support")
        .join("vaexcore studio")
        .join("api-discovery.json")
}

fn ws_url_from_api_url(api_url: &str) -> String {
    let base = api_url.trim_end_matches('/');
    let ws_base = if let Some(rest) = base.strip_prefix("https://") {
        format!("wss://{rest}")
    } else if let Some(rest) = base.strip_prefix("http://") {
        format!("ws://{rest}")
    } else {
        base.to_string()
    };
    format!("{}/events", ws_base.trim_end_matches('/'))
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
            detail: format!("Pulse could not find this file: {}", media_path),
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
                "macOS did not allow Pulse to read this file: {}",
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
                "The file is available, but Pulse could not inspect it.".to_string()
            } else {
                format!(
                    "The file is available, but Pulse could not inspect it: {}",
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
                "The file is available, but Pulse could not read it as a video.".to_string()
            } else {
                format!(
                    "The file is available, but Pulse could not read it as a video: {}",
                    stderr
                )
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
        .find(|stream| stream.get("codec_type").and_then(|value| value.as_str()) == Some("video"))
        .and_then(|stream| stream.get("codec_name"))
        .and_then(|value| value.as_str())
        .map(ToOwned::to_owned);
    let audio_codec = streams
        .iter()
        .find(|stream| stream.get("codec_type").and_then(|value| value.as_str()) == Some("audio"))
        .and_then(|stream| stream.get("codec_name"))
        .and_then(|value| value.as_str())
        .map(ToOwned::to_owned);

    let detail = match (video_codec.as_deref(), audio_codec.as_deref()) {
        (Some("h264"), Some("aac")) => "The file is available and should be playable.".to_string(),
        (Some(_), Some(_)) => {
            "The file is available, but this video format may not preview correctly.".to_string()
        }
        (Some(_), None) => "The file is available, but it may not include audio.".to_string(),
        _ => "The file is available, but Pulse could not confirm the video format.".to_string(),
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
            "Pulse could not read this video to prepare a preview: {}",
            media_path
        ));
    }

    match Command::new("ffmpeg").arg("-version").output() {
        Ok(output) if output.status.success() => {}
        Ok(_) => return Err("Pulse could not prepare a video preview.".to_string()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err("Pulse could not prepare a video preview.".to_string())
        }
        Err(error) => {
            return Err(format!(
                "Pulse could not prepare a video preview: {}",
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
    let preview_path = cache_dir.join(format!("{}-{:016x}.mp4", preview_stem, cache_key));

    if preview_path.exists() {
        let existing_metadata = fs::metadata(&preview_path).map_err(|error| error.to_string())?;
        if existing_metadata.len() > 0 {
            return Ok(PreparedMediaPreview {
                preview_path: preview_path.to_string_lossy().to_string(),
                reused_existing: true,
                file_size_bytes: Some(existing_metadata.len()),
                duration_seconds: clip_duration_seconds,
                detail: "Pulse reused an existing preview for this moment.".to_string(),
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
                .ok_or_else(|| "Pulse could not prepare a video preview.".to_string())?,
        ])
        .output()
        .map_err(|error| format!("Pulse could not prepare a video preview: {}", error))?;

    if !ffmpeg_output.status.success() {
        let _ = fs::remove_file(&preview_path);
        let stderr = String::from_utf8_lossy(&ffmpeg_output.stderr)
            .trim()
            .to_string();
        if stderr.is_empty() {
            return Err("Pulse could not prepare a preview for this moment.".to_string());
        }

        return Err(format!(
            "Pulse could not prepare a preview for this moment: {}",
            stderr
        ));
    }

    let preview_metadata = fs::metadata(&preview_path).map_err(|error| error.to_string())?;

    Ok(PreparedMediaPreview {
        preview_path: preview_path.to_string_lossy().to_string(),
        reused_existing: false,
        file_size_bytes: Some(preview_metadata.len()),
        duration_seconds: clip_duration_seconds,
        detail: "Pulse prepared a preview for this moment.".to_string(),
    })
}

#[tauri::command]
fn open_media_in_quicktime(
    media_path: String,
    start_seconds: Option<f64>,
) -> Result<String, String> {
    if !Path::new(&media_path).exists() {
        return Err(format!("File not found: {}", media_path));
    }

    let normalized_seconds = start_seconds.unwrap_or(0.0).max(0.0);
    let escaped_path = media_path.replace('\\', "\\\\").replace('"', "\\\"");
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
        Ok(output) if output.status.success() => {
            Ok("Opened this file in QuickTime and jumped to the requested moment.".to_string())
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let fallback = Command::new("open")
                .args(["-a", "QuickTime Player", &media_path])
                .status()
                .map_err(|error| error.to_string())?;
            if fallback.success() {
                if stderr.is_empty() {
                    Ok("Opened this file in QuickTime, but could not jump to the exact timestamp automatically.".to_string())
                } else {
                    Ok(format!(
                        "Opened this file in QuickTime, but could not jump to the exact timestamp automatically: {}",
                        stderr
                    ))
                }
            } else {
                Err("Could not open this file in QuickTime.".to_string())
            }
        }
        Err(error) => Err(format!("Could not open QuickTime: {}", error)),
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
        .fold(0_u64, |sum, (_, size_bytes, _)| {
            sum.saturating_add(*size_bytes)
        });
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
