use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, PhysicalPosition, Runtime, Window};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioLevelEvent {
    pub level: f32,
    pub confidence: f32,
}

/// Show the floating indicator window
#[tauri::command]
pub async fn show_floating_indicator<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("floating-indicator") {
        // Position window on the right side of the screen
        if let Ok(monitor) = window.current_monitor() {
            if let Some(monitor) = monitor {
                let size = monitor.size();
                let window_width = 200;
                let window_height = 80;
                
                // Position on the right side, vertically centered
                let x = size.width as i32 - window_width - 20; // 20px from right edge
                let y = (size.height as i32 / 2) - (window_height / 2);
                
                let _ = window.set_position(PhysicalPosition::new(x, y));
            }
        }
        
        let _ = window.set_always_on_top(true);
        let _ = window.show();
        let _ = window.set_focus();
        
        Ok(())
    } else {
        Err("Floating indicator window not found".to_string())
    }
}

/// Hide the floating indicator window
#[tauri::command]
pub async fn hide_floating_indicator<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("floating-indicator") {
        let _ = window.hide();
        Ok(())
    } else {
        Err("Floating indicator window not found".to_string())
    }
}

/// Update audio level for the floating indicator
#[tauri::command]
pub async fn update_audio_level<R: Runtime>(
    app: AppHandle<R>,
    level: f32,
    confidence: f32,
) -> Result<(), String> {
    app.emit(
        "audio-level-update",
        AudioLevelEvent { level, confidence },
    )
    .map_err(|e| format!("Failed to emit audio level: {}", e))?;
    
    Ok(())
}

/// Position the floating indicator on a specific monitor
#[tauri::command]
pub async fn position_floating_indicator<R: Runtime>(
    app: AppHandle<R>,
    x: i32,
    y: i32,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("floating-indicator") {
        window
            .set_position(PhysicalPosition::new(x, y))
            .map_err(|e| format!("Failed to position window: {}", e))?;
        Ok(())
    } else {
        Err("Floating indicator window not found".to_string())
    }
}

