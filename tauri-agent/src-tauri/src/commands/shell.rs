use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Arc;

use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use tauri::{Emitter, State};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::commands::sessions::resolve_workspace_dir;
use crate::commands::terminal::TerminalEvent;

pub struct ShellManager {
    sessions: Mutex<HashMap<String, ShellSession>>,
}

struct ShellSession {
    _master: Box<dyn portable_pty::MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn portable_pty::Child + Send>,
}

impl ShellManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellStartResult {
    pub session_id: String,
}

async fn emit_shell_output(window: &tauri::Window, data: String) -> Result<(), String> {
    window
        .emit(
            "shell-output",
            &TerminalEvent::Output { data },
        )
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn shell_start(
    workspace: Option<String>,
    window: tauri::Window,
    mgr: State<'_, Arc<ShellManager>>,
) -> Result<ShellStartResult, String> {
    let cwd = match workspace {
        Some(ws) if !ws.is_empty() => resolve_workspace_dir(&ws)?,
        _ => std::env::current_dir().map_err(|e| e.to_string())?,
    };

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 100,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("pty open failed: {e}"))?;

    let mut cmd = if cfg!(windows) {
        CommandBuilder::new("cmd.exe")
    } else {
        let mut c = CommandBuilder::new("bash");
        c.arg("-l");
        c
    };
    cmd.cwd(cwd);

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("shell spawn failed: {e}"))?;
    drop(pair.slave);

    let master = pair.master;
    let mut reader = master
        .try_clone_reader()
        .map_err(|e| format!("pty reader failed: {e}"))?;
    let writer = master
        .take_writer()
        .map_err(|e| format!("pty writer failed: {e}"))?;

    let session_id = Uuid::new_v4().to_string();
    let win = window.clone();
    let sid = session_id.clone();

    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = tauri::async_runtime::block_on(emit_shell_output(&win, chunk));
                }
                Err(_) => break,
            }
        }
        let _ = win.emit(
            "shell-output",
            &TerminalEvent::Exit {
                exit_code: 0,
            },
        );
        let _ = sid;
    });

    mgr.sessions
        .lock()
        .await
        .insert(
            session_id.clone(),
            ShellSession {
                _master: master,
                writer,
                child,
            },
        );

    Ok(ShellStartResult { session_id })
}

#[tauri::command]
pub async fn shell_write(
    session_id: String,
    data: String,
    mgr: State<'_, Arc<ShellManager>>,
) -> Result<(), String> {
    let mut sessions = mgr.sessions.lock().await;
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| "shell session not found".to_string())?;
    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("shell write failed: {e}"))?;
    session.writer.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn shell_resize(
    session_id: String,
    rows: u16,
    cols: u16,
    mgr: State<'_, Arc<ShellManager>>,
) -> Result<(), String> {
    let _ = (session_id, rows, cols, mgr);
    Ok(())
}

#[tauri::command]
pub async fn shell_stop(
    session_id: String,
    mgr: State<'_, Arc<ShellManager>>,
) -> Result<(), String> {
    let mut sessions = mgr.sessions.lock().await;
    if let Some(mut session) = sessions.remove(&session_id) {
        let _ = session.child.kill();
    }
    Ok(())
}
