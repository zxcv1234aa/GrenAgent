pub fn sanitize_error(e: impl std::fmt::Display) -> String {
    let detailed = e.to_string();
    eprintln!("[tauri-agent] error: {}", detailed);

    #[cfg(debug_assertions)]
    return detailed;

    #[cfg(not(debug_assertions))]
    "Operation failed. Check backend logs for details.".to_string()
}
