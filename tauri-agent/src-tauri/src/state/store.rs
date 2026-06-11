use std::path::PathBuf;
use std::sync::Arc;

use tokio::sync::Mutex;

use crate::state::AppState;

/// 线程安全的 AppState 持有者 + 持久化路径。作为 Tauri managed state。
#[derive(Clone)]
pub struct AppStateStore {
    inner: Arc<Mutex<AppState>>,
    path: PathBuf,
}

impl AppStateStore {
    pub fn new(path: PathBuf) -> Self {
        let state = AppState::load(&path);
        Self { inner: Arc::new(Mutex::new(state)), path }
    }

    /// 修改并立即持久化（错误打印，不致命）。
    pub async fn update<F: FnOnce(&mut AppState)>(&self, f: F) {
        let mut guard = self.inner.lock().await;
        f(&mut guard);
        if let Err(e) = guard.save(&self.path) {
            eprintln!("[app-state] save failed: {e}");
        }
    }

    pub async fn last_session_for(&self, workspace: &str) -> Option<String> {
        self.inner
            .lock()
            .await
            .last_session(workspace)
            .map(str::to_string)
    }

    pub async fn is_approved(&self, workspace: &str) -> bool {
        self.inner
            .lock()
            .await
            .is_workspace_approved(workspace)
    }
}
