use serde::Serialize;

use crate::commands::sessions::{
    collect_session_files, parse_session_header, paths_equivalent, read_first_line, sessions_dir,
};

/// works 根目录：~/.pi/agent/works（与 sessions 同源）。
fn works_dir() -> Option<std::path::PathBuf> {
    dirs::home_dir().map(|h| h.join(".pi").join("agent").join("works"))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationInfo {
    pub cwd: String,
}

/// FR-1：在 ~/.pi/agent/works/<uuid> 下创建目录，返回 canonical 路径。
#[tauri::command]
pub async fn create_conversation() -> Result<ConversationInfo, String> {
    let base = works_dir().ok_or("works directory unavailable")?;
    std::fs::create_dir_all(&base).map_err(|e| format!("create works dir failed: {e}"))?;
    let dir = base.join(uuid::Uuid::new_v4().to_string());
    std::fs::create_dir_all(&dir).map_err(|e| format!("create conversation dir failed: {e}"))?;
    let cwd = std::fs::canonicalize(&dir).map_err(|e| format!("canonicalize failed: {e}"))?;
    Ok(ConversationInfo {
        cwd: cwd.to_string_lossy().to_string(),
    })
}

/// 供前端做"是否对话"前缀判断：返回 ~/.pi/agent/works 的 canonical 路径。
#[tauri::command]
pub async fn get_works_dir() -> Result<String, String> {
    let base = works_dir().ok_or("works directory unavailable")?;
    std::fs::create_dir_all(&base).map_err(|e| format!("create works dir failed: {e}"))?;
    let canon = std::fs::canonicalize(&base).map_err(|e| format!("canonicalize failed: {e}"))?;
    Ok(canon.to_string_lossy().to_string())
}

/// 删除 sessions/ 下所有 header.cwd 等价于 `cwd` 的 .jsonl，返回删除条数。
/// 仅在 sessions 根内操作，跳过符号链接/非 jsonl。
#[allow(dead_code)]
pub(crate) fn delete_sessions_for_cwd(cwd: &str) -> Result<usize, String> {
    let sessions_root = sessions_dir().ok_or("sessions directory unavailable")?;
    let canonical_sessions = match std::fs::canonicalize(&sessions_root) {
        Ok(c) => c,
        Err(_) => return Ok(0),
    };
    let mut files = Vec::new();
    collect_session_files(&canonical_sessions, &mut files);
    let mut count = 0usize;
    for path in files {
        let first = match read_first_line(&path) {
            Ok(s) => s,
            Err(_) => continue,
        };
        let path_str = path.to_string_lossy().to_string();
        let info = match parse_session_header(&first, &path_str) {
            Some(i) => i,
            None => continue,
        };
        let matches = info
            .cwd
            .as_deref()
            .map(|c| paths_equivalent(c, cwd))
            .unwrap_or(false);
        if !matches {
            continue;
        }
        let canon = match std::fs::canonicalize(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        if !canon.starts_with(&canonical_sessions) {
            continue;
        }
        if canon.extension().and_then(|e| e.to_str()) != Some("jsonl") {
            continue;
        }
        if std::fs::symlink_metadata(&path)
            .map(|m| m.is_symlink())
            .unwrap_or(false)
        {
            continue;
        }
        if std::fs::remove_file(&path).is_ok() {
            count += 1;
        }
    }
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn works_dir_under_pi_agent() {
        let d = works_dir().unwrap();
        assert!(d.ends_with("works"));
        assert!(d
            .to_string_lossy()
            .replace('\\', "/")
            .contains(".pi/agent/works"));
    }

    #[test]
    fn delete_matcher_uses_paths_equivalent() {
        let with = "{\"type\":\"session\",\"id\":\"a\",\"cwd\":\"C:/ws/a\",\"timestamp\":\"t\"}\n";
        let info = parse_session_header(with, "/tmp/a.jsonl").unwrap();
        assert!(paths_equivalent(info.cwd.as_deref().unwrap(), "C:\\ws\\a"));
    }
}
