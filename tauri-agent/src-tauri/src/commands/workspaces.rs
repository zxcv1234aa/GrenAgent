use serde::Serialize;

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
}
