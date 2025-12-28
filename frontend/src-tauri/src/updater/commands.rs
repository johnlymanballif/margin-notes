use tauri::{command, AppHandle, Manager};
use tauri_plugin_updater::{UpdaterBuilder, Update};

#[derive(serde::Serialize)]
pub struct UpdateCheckResult {
    pub available: bool,
    pub current_version: String,
    pub version: Option<String>,
    pub body: Option<String>,
    pub error: Option<String>,
}

/// Check for available updates
#[command]
pub async fn check_for_updates(app: AppHandle) -> Result<UpdateCheckResult, String> {
    let current_version = app.package_info().version.to_string();
    
    log::info!("Checking for updates. Current version: {}", current_version);
    
    match UpdaterBuilder::new().app_handle(app.clone()).build() {
        Ok(updater) => {
            match updater.check().await {
                Ok(Some(update)) => {
                    log::info!("Update available: {}", update.version);
                    Ok(UpdateCheckResult {
                        available: true,
                        current_version,
                        version: Some(update.version.to_string()),
                        body: update.body,
                        error: None,
                    })
                }
                Ok(None) => {
                    log::info!("No updates available");
                    Ok(UpdateCheckResult {
                        available: false,
                        current_version,
                        version: None,
                        body: None,
                        error: None,
                    })
                }
                Err(e) => {
                    log::error!("Error checking for updates: {}", e);
                    Ok(UpdateCheckResult {
                        available: false,
                        current_version,
                        version: None,
                        body: None,
                        error: Some(format!("Failed to check for updates: {}", e)),
                    })
                }
            }
        }
        Err(e) => {
            log::error!("Failed to build updater: {}", e);
            Ok(UpdateCheckResult {
                available: false,
                current_version,
                version: None,
                body: None,
                error: Some(format!("Failed to initialize updater: {}", e)),
            })
        }
    }
}

/// Download and install the available update
#[command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    log::info!("Starting update installation...");
    
    let updater = UpdaterBuilder::new()
        .app_handle(app.clone())
        .build()
        .map_err(|e| format!("Failed to build updater: {}", e))?;
    
    let update = updater
        .check()
        .await
        .map_err(|e| format!("Failed to check for updates: {}", e))?
        .ok_or_else(|| "No update available".to_string())?;
    
    log::info!("Downloading update: {}", update.version);
    
    // Download the update
    update
        .download_and_install(
            |chunk_length, content_length| {
                let progress = if let Some(total) = content_length {
                    (chunk_length as f64 / total as f64 * 100.0) as u8
                } else {
                    0
                };
                log::info!("Update download progress: {}%", progress);
            },
            || {
                log::info!("Update download complete, installing...");
            },
        )
        .await
        .map_err(|e| format!("Failed to install update: {}", e))?;
    
    log::info!("Update installed successfully. Restarting application...");
    
    // Restart the application
    app.restart();
    
    Ok(())
}

