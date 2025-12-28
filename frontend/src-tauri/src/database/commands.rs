use log::{error, info};
use serde::{Serialize, Deserialize};
use std::path::PathBuf;
use std::fs;
use tauri::{AppHandle, Emitter, Manager};
use sqlx::Row;

use super::manager::DatabaseManager;
use crate::state::AppState;
use crate::database::models::{Tag, Folder};
use crate::database::repositories::{tag::TagsRepository, folder::FoldersRepository};

#[derive(Serialize)]
pub struct DatabaseCheckResult {
    pub exists: bool,
    pub size: u64,
}

/// Check if this is the first launch (no database exists yet)
#[tauri::command]
pub async fn check_first_launch(app: AppHandle) -> Result<bool, String> {
    DatabaseManager::is_first_launch(&app)
        .await
        .map_err(|e| format!("Failed to check first launch: {}", e))
}

/// Open a dialog to select a folder or file for legacy database import
#[tauri::command]
pub async fn select_legacy_database_path(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    info!("Opening dialog to select legacy database location");

    let file_path = app
        .dialog()
        .file()
        .add_filter("Database Files", &["db"])
        .blocking_pick_file();

    if let Some(path) = file_path {
        let path_str = path.to_string();
        info!("User selected path: {}", path_str);
        Ok(Some(path_str))
    } else {
        info!("User cancelled file selection");
        Ok(None)
    }
}

/// Detect legacy database from a selected path (root repo, backend folder, or db file)
#[tauri::command]
pub async fn detect_legacy_database(selected_path: String) -> Result<Option<String>, String> {
    let path = PathBuf::from(&selected_path);

    info!("Detecting legacy database from path: {}", selected_path);

    // Case 1: User selected the .db file directly
    if path.is_file() {
        if let Some(extension) = path.extension() {
            if extension == "db" {
                info!("Direct .db file selected: {}", selected_path);
                return Ok(Some(selected_path));
            }
        }
    }

    // Case 2: User selected directory containing meeting_minutes.db
    if path.is_dir() {
        let direct_db = path.join("meeting_minutes.db");
        if direct_db.exists() && direct_db.is_file() {
            let db_path = direct_db.to_string_lossy().to_string();
            info!("Found database in selected directory: {}", db_path);
            return Ok(Some(db_path));
        }

        // Case 3: User selected root repo (check backend subdirectory)
        let backend_db = path.join("backend").join("meeting_minutes.db");
        if backend_db.exists() && backend_db.is_file() {
            let db_path = backend_db.to_string_lossy().to_string();
            info!("Found database in backend subdirectory: {}", db_path);
            return Ok(Some(db_path));
        }
    }

    info!("No legacy database found at path: {}", selected_path);
    Ok(None)
}

/// Check if the Homebrew database exists and return its size
/// This is specifically for detecting old Python backend installations
#[tauri::command]
pub async fn check_homebrew_database(path: String) -> Result<Option<DatabaseCheckResult>, String> {
    let db_path = PathBuf::from(&path);
    
    info!("Checking for Homebrew database at: {}", path);
    
    // Check if file exists and is a regular file
    if db_path.exists() && db_path.is_file() {
        // Get file metadata to check size
        match std::fs::metadata(&db_path) {
            Ok(metadata) => {
                let size = metadata.len();
                info!("Found Homebrew database: {} ({} bytes)", path, size);
                
                // Only consider it valid if it has content (not empty)
                if size > 0 {
                    Ok(Some(DatabaseCheckResult {
                        exists: true,
                        size,
                    }))
                } else {
                    info!("Database file exists but is empty");
                    Ok(None)
                }
            }
            Err(e) => {
                error!("Failed to read database metadata: {}", e);
                Ok(None)
            }
        }
    } else {
        info!("No database found at Homebrew location");
        Ok(None)
    }
}

/// Import legacy database and initialize the database manager
#[tauri::command]
pub async fn import_and_initialize_database(
    app: AppHandle,
    legacy_db_path: String,
) -> Result<(), String> {
    info!(
        "Starting import of legacy database from: {}",
        legacy_db_path
    );

    // Import and get initialized manager
    let db_manager = DatabaseManager::import_legacy_database(&app, &legacy_db_path)
        .await
        .map_err(|e| {
            error!("Failed to import legacy database: {}", e);
            format!("Failed to import database: {}", e)
        })?;

    // Update app state with the new manager
    app.manage(AppState { db_manager });

    info!("Legacy database imported and initialized successfully");

    // Emit event to notify frontend that database is ready
    app.emit("database-initialized", ())
        .map_err(|e| format!("Failed to emit database-initialized event: {}", e))?;

    Ok(())
}

/// Initialize a fresh database (for users who don't want to import)
#[tauri::command]
pub async fn initialize_fresh_database(app: AppHandle) -> Result<(), String> {
    info!("Initializing fresh database");

    let db_manager = DatabaseManager::new_from_app_handle(&app)
        .await
        .map_err(|e| {
            error!("Failed to initialize fresh database: {}", e);
            format!("Failed to initialize database: {}", e)
        })?;

    // Update app state with the new manager
    app.manage(AppState { db_manager });

    info!("Fresh database initialized successfully");

    // Emit event to notify frontend that database is ready
    app.emit("database-initialized", ())
        .map_err(|e| format!("Failed to emit database-initialized event: {}", e))?;

    Ok(())
}

/// Get the database directory path
#[tauri::command]
pub async fn get_database_directory(app: AppHandle) -> Result<String, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    Ok(app_data_dir.to_string_lossy().to_string())
}

/// Open the database folder in the system file explorer
#[tauri::command]
pub async fn open_database_folder(app: AppHandle) -> Result<(), String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    // Ensure directory exists before trying to open it
    if !app_data_dir.exists() {
        std::fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let folder_path = app_data_dir.to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&folder_path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&folder_path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&folder_path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    info!("Opened database folder: {}", folder_path);
    Ok(())
}

// Speaker and Company Management Commands

use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize)]
pub struct Speaker {
    pub id: String,
    pub name: String,
    pub company_id: Option<String>,
    pub company_name: Option<String>,
    pub email: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

impl<'r> sqlx::FromRow<'r, sqlx::sqlite::SqliteRow> for Speaker {
    fn from_row(row: &'r sqlx::sqlite::SqliteRow) -> Result<Self, sqlx::Error> {
        Ok(Speaker {
            id: row.get("id"),
            name: row.get("name"),
            company_id: row.try_get("company_id").ok(),
            company_name: row.try_get("company_name").ok(),
            email: row.try_get("email").ok(),
            created_at: row.try_get("created_at").ok(),
            updated_at: row.try_get("updated_at").ok(),
        })
    }
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Company {
    pub id: String,
    pub name: String,
    #[sqlx(default)]
    pub created_at: Option<String>,
    #[sqlx(default)]
    pub updated_at: Option<String>,
}

/// Get all speakers (optionally filtered by meeting_id)
#[tauri::command]
pub async fn get_speakers(app: AppHandle, meeting_id: Option<String>) -> Result<Vec<Speaker>, String> {
    let state = app.state::<AppState>();
    let pool = state.db_manager.pool();
    
    let query = if let Some(_meeting_id) = meeting_id {
        // For now, return all speakers. In the future, we could filter by meeting
        sqlx::query_as::<_, Speaker>(
            r#"
            SELECT 
                s.id,
                s.name,
                s.company_id,
                c.name as company_name,
                s.email,
                s.created_at,
                s.updated_at
            FROM speakers s
            LEFT JOIN companies c ON s.company_id = c.id
            ORDER BY s.name
            "#
        )
    } else {
        sqlx::query_as::<_, Speaker>(
            r#"
            SELECT 
                s.id,
                s.name,
                s.company_id,
                c.name as company_name,
                s.email,
                s.created_at,
                s.updated_at
            FROM speakers s
            LEFT JOIN companies c ON s.company_id = c.id
            ORDER BY s.name
            "#
        )
    };
    
    let speakers = query
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Failed to fetch speakers: {}", e))?;
    
    Ok(speakers)
}

/// Create a new speaker
#[tauri::command]
pub async fn create_speaker(
    app: AppHandle,
    name: String,
    email: Option<String>,
    company_id: Option<String>,
) -> Result<Speaker, String> {
    let state = app.state::<AppState>();
    let pool = state.db_manager.pool();
    
    let id = format!("speaker-{}", uuid::Uuid::new_v4());
    let now = chrono::Utc::now().to_rfc3339();
    
    sqlx::query(
        r#"
        INSERT INTO speakers (id, name, email, company_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(&id)
    .bind(&name)
    .bind(&email)
    .bind(&company_id)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to create speaker: {}", e))?;
    
    // Fetch the created speaker with company name
    let speaker = sqlx::query_as::<_, Speaker>(
        r#"
        SELECT 
            s.id,
            s.name,
            s.company_id,
            c.name as company_name,
            s.email,
            s.created_at,
            s.updated_at
        FROM speakers s
        LEFT JOIN companies c ON s.company_id = c.id
        WHERE s.id = ?
        "#
    )
    .bind(&id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Failed to fetch created speaker: {}", e))?;
    
    Ok(speaker)
}

/// Update a speaker
#[tauri::command]
pub async fn update_speaker(
    app: AppHandle,
    id: String,
    name: String,
    email: Option<String>,
    company_id: Option<String>,
) -> Result<Speaker, String> {
    let state = app.state::<AppState>();
    let pool = state.db_manager.pool();
    
    let now = chrono::Utc::now().to_rfc3339();
    
    sqlx::query(
        r#"
        UPDATE speakers
        SET name = ?, email = ?, company_id = ?, updated_at = ?
        WHERE id = ?
        "#
    )
    .bind(&name)
    .bind(&email)
    .bind(&company_id)
    .bind(&now)
    .bind(&id)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to update speaker: {}", e))?;
    
    // Fetch the updated speaker with company name
    let speaker = sqlx::query_as::<_, Speaker>(
        r#"
        SELECT 
            s.id,
            s.name,
            s.company_id,
            c.name as company_name,
            s.email,
            s.created_at,
            s.updated_at
        FROM speakers s
        LEFT JOIN companies c ON s.company_id = c.id
        WHERE s.id = ?
        "#
    )
    .bind(&id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Failed to fetch updated speaker: {}", e))?;
    
    Ok(speaker)
}

/// Delete a speaker
#[tauri::command]
pub async fn delete_speaker(app: AppHandle, id: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    let pool = state.db_manager.pool();
    
    sqlx::query("DELETE FROM speakers WHERE id = ?")
        .bind(&id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to delete speaker: {}", e))?;
    
    // Also remove speaker assignments from transcripts
    sqlx::query("UPDATE transcripts SET speaker_id = NULL, speaker_name = NULL WHERE speaker_id = ?")
        .bind(&id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to update transcripts: {}", e))?;
    
    Ok(())
}

/// Get all companies
#[tauri::command]
pub async fn get_companies(app: AppHandle) -> Result<Vec<Company>, String> {
    let state = app.state::<AppState>();
    let pool = state.db_manager.pool();
    
    let companies = sqlx::query_as::<_, Company>(
        "SELECT id, name, created_at, updated_at FROM companies ORDER BY name"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch companies: {}", e))?;
    
    Ok(companies)
}

/// Create a new company
#[tauri::command]
pub async fn create_company(app: AppHandle, name: String) -> Result<Company, String> {
    let state = app.state::<AppState>();
    let pool = state.db_manager.pool();
    
    let id = format!("company-{}", uuid::Uuid::new_v4());
    let now = chrono::Utc::now().to_rfc3339();
    
    sqlx::query(
        "INSERT INTO companies (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&name)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to create company: {}", e))?;
    
    let company = sqlx::query_as::<_, Company>(
        "SELECT id, name, created_at, updated_at FROM companies WHERE id = ?"
    )
    .bind(&id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Failed to fetch created company: {}", e))?;
    
    Ok(company)
}

/// Update a company
#[tauri::command]
pub async fn update_company(app: AppHandle, id: String, name: String) -> Result<Company, String> {
    let state = app.state::<AppState>();
    let pool = state.db_manager.pool();
    
    let now = chrono::Utc::now().to_rfc3339();
    
    sqlx::query(
        "UPDATE companies SET name = ?, updated_at = ? WHERE id = ?"
    )
    .bind(&name)
    .bind(&now)
    .bind(&id)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to update company: {}", e))?;
    
    let company = sqlx::query_as::<_, Company>(
        "SELECT id, name, created_at, updated_at FROM companies WHERE id = ?"
    )
    .bind(&id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Failed to fetch updated company: {}", e))?;
    
    Ok(company)
}

/// Delete a company
#[tauri::command]
pub async fn delete_company(app: AppHandle, id: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    let pool = state.db_manager.pool();
    
    // Remove company assignments from speakers
    sqlx::query("UPDATE speakers SET company_id = NULL WHERE company_id = ?")
        .bind(&id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to update speakers: {}", e))?;
    
    // Delete the company
    sqlx::query("DELETE FROM companies WHERE id = ?")
        .bind(&id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to delete company: {}", e))?;
    
    Ok(())
}

/// Update transcript speaker assignment
#[tauri::command]
pub async fn update_transcript_speaker(
    app: AppHandle,
    transcript_id: String,
    speaker_id: Option<String>,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    let pool = state.db_manager.pool();
    
    if let Some(speaker_id) = &speaker_id {
        // Get speaker name
        let speaker = sqlx::query_as::<_, Speaker>(
            r#"
            SELECT 
                s.id,
                s.name,
                s.company_id,
                c.name as company_name,
                s.email,
                s.created_at,
                s.updated_at
            FROM speakers s
            LEFT JOIN companies c ON s.company_id = c.id
            WHERE s.id = ?
            "#
        )
        .bind(speaker_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("Failed to fetch speaker: {}", e))?;
        
        if let Some(speaker) = speaker {
            sqlx::query(
                "UPDATE transcripts SET speaker_id = ?, speaker_name = ? WHERE id = ?"
            )
            .bind(speaker_id)
            .bind(&speaker.name)
            .bind(&transcript_id)
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to update transcript speaker: {}", e))?;
        } else {
            return Err("Speaker not found".to_string());
        }
    } else {
        // Remove speaker assignment
        sqlx::query(
            "UPDATE transcripts SET speaker_id = NULL, speaker_name = NULL WHERE id = ?"
        )
        .bind(&transcript_id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to remove transcript speaker: {}", e))?;
    }
    
    Ok(())
}

// ============================================================================
// TAG COMMANDS
// ============================================================================

/// Get all tags
#[tauri::command]
pub async fn get_all_tags(app: AppHandle) -> Result<Vec<Tag>, String> {
    let state = app.state::<AppState>();
    let pool = state.db_manager.pool();
    
    TagsRepository::get_all_tags(pool)
        .await
        .map_err(|e| format!("Failed to get tags: {}", e))
}

/// Create a new tag
#[tauri::command]
pub async fn create_tag(
    app: AppHandle,
    name: String,
    color: Option<String>,
) -> Result<Tag, String> {
    let state = app.state::<AppState>();
    let pool = state.db_manager.pool();
    
    TagsRepository::create_tag(pool, &name, color.as_deref())
        .await
        .map_err(|e| format!("Failed to create tag: {}", e))
}

/// Update a tag
#[tauri::command]
pub async fn update_tag(
    app: AppHandle,
    id: String,
    name: String,
    color: Option<String>,
) -> Result<Tag, String> {
    let state = app.state::<AppState>();
    let pool = state.db_manager.pool();
    
    TagsRepository::update_tag(pool, &id, &name, color.as_deref())
        .await
        .map_err(|e| format!("Failed to update tag: {}", e))
}

/// Delete a tag
#[tauri::command]
pub async fn delete_tag(app: AppHandle, id: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    let pool = state.db_manager.pool();
    
    TagsRepository::delete_tag(pool, &id)
        .await
        .map_err(|e| format!("Failed to delete tag: {}", e))?;
    
    Ok(())
}

/// Get tags for a meeting
#[tauri::command]
pub async fn get_meeting_tags(app: AppHandle, meeting_id: String) -> Result<Vec<Tag>, String> {
    let state = app.state::<AppState>();
    let pool = state.db_manager.pool();
    
    TagsRepository::get_meeting_tags(pool, &meeting_id)
        .await
        .map_err(|e| format!("Failed to get meeting tags: {}", e))
}

/// Add a tag to a meeting
#[tauri::command]
pub async fn add_tag_to_meeting(
    app: AppHandle,
    meeting_id: String,
    tag_id: String,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    let pool = state.db_manager.pool();
    
    TagsRepository::add_tag_to_meeting(pool, &meeting_id, &tag_id)
        .await
        .map_err(|e| format!("Failed to add tag to meeting: {}", e))
}

/// Remove a tag from a meeting
#[tauri::command]
pub async fn remove_tag_from_meeting(
    app: AppHandle,
    meeting_id: String,
    tag_id: String,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    let pool = state.db_manager.pool();
    
    TagsRepository::remove_tag_from_meeting(pool, &meeting_id, &tag_id)
        .await
        .map_err(|e| format!("Failed to remove tag from meeting: {}", e))?;
    
    Ok(())
}

/// Set tags for a meeting (replaces all existing tags)
#[tauri::command]
pub async fn set_meeting_tags(
    app: AppHandle,
    meeting_id: String,
    tag_ids: Vec<String>,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    let pool = state.db_manager.pool();
    
    TagsRepository::set_meeting_tags(pool, &meeting_id, &tag_ids)
        .await
        .map_err(|e| format!("Failed to set meeting tags: {}", e))
}

// ============================================================================
// FOLDER COMMANDS
// ============================================================================

/// Get all folders
#[tauri::command]
pub async fn get_all_folders(app: AppHandle) -> Result<Vec<Folder>, String> {
    let state = app.state::<AppState>();
    let pool = state.db_manager.pool();
    
    FoldersRepository::get_all_folders(pool)
        .await
        .map_err(|e| format!("Failed to get folders: {}", e))
}

/// Get root folders (folders without a parent)
#[tauri::command]
pub async fn get_root_folders(app: AppHandle) -> Result<Vec<Folder>, String> {
    let state = app.state::<AppState>();
    let pool = state.db_manager.pool();
    
    FoldersRepository::get_root_folders(pool)
        .await
        .map_err(|e| format!("Failed to get root folders: {}", e))
}

/// Create a new folder
#[tauri::command]
pub async fn create_folder(
    app: AppHandle,
    name: String,
    color: Option<String>,
    parent_id: Option<String>,
) -> Result<Folder, String> {
    let state = app.state::<AppState>();
    let pool = state.db_manager.pool();
    
    FoldersRepository::create_folder(pool, &name, color.as_deref(), parent_id.as_deref())
        .await
        .map_err(|e| format!("Failed to create folder: {}", e))
}

/// Update a folder
#[tauri::command]
pub async fn update_folder(
    app: AppHandle,
    id: String,
    name: String,
    color: Option<String>,
    parent_id: Option<String>,
) -> Result<Folder, String> {
    let state = app.state::<AppState>();
    let pool = state.db_manager.pool();
    
    FoldersRepository::update_folder(pool, &id, &name, color.as_deref(), parent_id.as_deref())
        .await
        .map_err(|e| format!("Failed to update folder: {}", e))
}

/// Delete a folder
#[tauri::command]
pub async fn delete_folder(app: AppHandle, id: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    let pool = state.db_manager.pool();
    
    FoldersRepository::delete_folder(pool, &id)
        .await
        .map_err(|e| format!("Failed to delete folder: {}", e))?;
    
    Ok(())
}

/// Update meeting folder assignment
#[tauri::command]
pub async fn update_meeting_folder(
    app: AppHandle,
    meeting_id: String,
    folder_id: Option<String>,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    let pool = state.db_manager.pool();
    
    sqlx::query("UPDATE meetings SET folder_id = ? WHERE id = ?")
        .bind(&folder_id)
        .bind(&meeting_id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to update meeting folder: {}", e))?;
    
    Ok(())
}

/// Get master prompt for AI summaries
#[tauri::command]
pub async fn get_master_prompt(app: AppHandle) -> Result<String, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    let prompt_file = app_data_dir.join("master_prompt.txt");
    
    if prompt_file.exists() {
        match fs::read_to_string(&prompt_file) {
            Ok(content) => Ok(content),
            Err(_) => Ok(String::new()),
        }
    } else {
        Ok(String::new())
    }
}

/// Save master prompt for AI summaries
#[tauri::command]
pub async fn save_master_prompt(app: AppHandle, prompt: String) -> Result<(), String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    let prompt_file = app_data_dir.join("master_prompt.txt");
    
    fs::write(&prompt_file, prompt)
        .map_err(|e| format!("Failed to save master prompt: {}", e))?;
    
    Ok(())
}

/// Process uploaded audio file (MP3, WAV, etc.)
#[tauri::command]
pub async fn process_uploaded_audio(
    app: AppHandle,
    fileName: String,
    audioData: Vec<u8>,
) -> Result<serde_json::Value, String> {
    use chrono::Utc;
    
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    // Create recordings directory if it doesn't exist
    let recordings_dir = app_data_dir.join("recordings");
    if !recordings_dir.exists() {
        fs::create_dir_all(&recordings_dir)
            .map_err(|e| format!("Failed to create recordings directory: {}", e))?;
    }
    
    // Save uploaded file temporarily
    let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
    let temp_file_path = recordings_dir.join(format!("upload_{}_{}", timestamp, fileName));
    
    fs::write(&temp_file_path, audioData)
        .map_err(|e| format!("Failed to save uploaded file: {}", e))?;
    
    // Generate meeting ID and title
    let meeting_id = format!("meeting-{}", uuid::Uuid::new_v4());
    let meeting_title = fileName
        .replace(".mp3", "")
        .replace(".wav", "")
        .replace(".m4a", "")
        .replace(".aac", "")
        .replace("_", " ");
    
    // Save meeting to database
    let state = app.state::<AppState>();
    let pool = state.db_manager.pool();
    
    // Use the meeting repository to create the meeting
    let now = Utc::now().naive_utc();
    sqlx::query(
        r#"
        INSERT INTO meetings (id, title, created_at, updated_at, folder_path)
        VALUES (?, ?, ?, ?, ?)
        "#
    )
    .bind(&meeting_id)
    .bind(&meeting_title)
    .bind(now)
    .bind(now)
    .bind(temp_file_path.to_string_lossy().to_string())
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to save meeting: {}", e))?;
    
    // TODO: Process audio file through transcription system
    // For now, return success with meeting_id
    // In a full implementation, you would:
    // 1. Convert audio to WAV if needed
    // 2. Process through Whisper/Parakeet
    // 3. Save transcripts to database
    
    Ok(serde_json::json!({
        "meeting_id": meeting_id,
        "message": "Audio file uploaded successfully. Transcription will be processed."
    }))
}

/// Get transcripts for a meeting with pagination
#[tauri::command]
pub async fn get_meeting_transcripts_paginated(
    app: AppHandle,
    meeting_id: String,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<crate::database::models::Transcript>, String> {
    use crate::database::repositories::meeting::MeetingsRepository;
    
    let state = app.state::<AppState>();
    let pool = state.db_manager.pool();
    
    MeetingsRepository::get_meeting_transcripts_paginated(pool, &meeting_id, limit, offset)
        .await
        .map_err(|e| format!("Failed to get paginated transcripts: {}", e))
}

/// Get total count of transcripts for a meeting
#[tauri::command]
pub async fn get_meeting_transcript_count(
    app: AppHandle,
    meeting_id: String,
) -> Result<i64, String> {
    use crate::database::repositories::meeting::MeetingsRepository;
    
    let state = app.state::<AppState>();
    let pool = state.db_manager.pool();
    
    MeetingsRepository::get_meeting_transcript_count(pool, &meeting_id)
        .await
        .map_err(|e| format!("Failed to get transcript count: {}", e))
}
