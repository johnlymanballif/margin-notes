use crate::database::models::Folder;
use sqlx::{Error as SqlxError, SqlitePool};
use tracing::info;
use uuid::Uuid;

pub struct FoldersRepository;

impl FoldersRepository {
    /// Get all folders
    pub async fn get_all_folders(pool: &SqlitePool) -> Result<Vec<Folder>, SqlxError> {
        let folders = sqlx::query_as::<_, Folder>(
            "SELECT id, name, color, parent_id, created_at, updated_at FROM folders ORDER BY name"
        )
        .fetch_all(pool)
        .await?;
        Ok(folders)
    }

    /// Get root folders (folders without a parent)
    pub async fn get_root_folders(pool: &SqlitePool) -> Result<Vec<Folder>, SqlxError> {
        let folders = sqlx::query_as::<_, Folder>(
            "SELECT id, name, color, parent_id, created_at, updated_at FROM folders WHERE parent_id IS NULL ORDER BY name"
        )
        .fetch_all(pool)
        .await?;
        Ok(folders)
    }

    /// Get child folders of a parent folder
    pub async fn get_child_folders(
        pool: &SqlitePool,
        parent_id: &str,
    ) -> Result<Vec<Folder>, SqlxError> {
        let folders = sqlx::query_as::<_, Folder>(
            "SELECT id, name, color, parent_id, created_at, updated_at FROM folders WHERE parent_id = ? ORDER BY name"
        )
        .bind(parent_id)
        .fetch_all(pool)
        .await?;
        Ok(folders)
    }

    /// Get a folder by ID
    pub async fn get_folder_by_id(
        pool: &SqlitePool,
        folder_id: &str,
    ) -> Result<Option<Folder>, SqlxError> {
        let folder = sqlx::query_as::<_, Folder>(
            "SELECT id, name, color, parent_id, created_at, updated_at FROM folders WHERE id = ?"
        )
        .bind(folder_id)
        .fetch_optional(pool)
        .await?;
        Ok(folder)
    }

    /// Create a new folder
    pub async fn create_folder(
        pool: &SqlitePool,
        name: &str,
        color: Option<&str>,
        parent_id: Option<&str>,
    ) -> Result<Folder, SqlxError> {
        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now();

        sqlx::query(
            "INSERT INTO folders (id, name, color, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(name)
        .bind(color)
        .bind(parent_id)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;

        let folder = sqlx::query_as::<_, Folder>(
            "SELECT id, name, color, parent_id, created_at, updated_at FROM folders WHERE id = ?"
        )
        .bind(&id)
        .fetch_one(pool)
        .await?;

        info!("Created folder: {} ({})", name, id);
        Ok(folder)
    }

    /// Update a folder
    pub async fn update_folder(
        pool: &SqlitePool,
        folder_id: &str,
        name: &str,
        color: Option<&str>,
        parent_id: Option<&str>,
    ) -> Result<Folder, SqlxError> {
        let now = chrono::Utc::now();

        sqlx::query(
            "UPDATE folders SET name = ?, color = ?, parent_id = ?, updated_at = ? WHERE id = ?"
        )
        .bind(name)
        .bind(color)
        .bind(parent_id)
        .bind(now)
        .bind(folder_id)
        .execute(pool)
        .await?;

        let folder = sqlx::query_as::<_, Folder>(
            "SELECT id, name, color, parent_id, created_at, updated_at FROM folders WHERE id = ?"
        )
        .bind(folder_id)
        .fetch_one(pool)
        .await?;

        info!("Updated folder: {} ({})", name, folder_id);
        Ok(folder)
    }

    /// Delete a folder (moves meetings to NULL folder if any)
    pub async fn delete_folder(pool: &SqlitePool, folder_id: &str) -> Result<bool, SqlxError> {
        let mut transaction = pool.begin().await?;

        // Move meetings to NULL folder (no folder)
        sqlx::query("UPDATE meetings SET folder_id = NULL WHERE folder_id = ?")
            .bind(folder_id)
            .execute(&mut *transaction)
            .await?;

        // Move child folders to NULL (make them root folders)
        sqlx::query("UPDATE folders SET parent_id = NULL WHERE parent_id = ?")
            .bind(folder_id)
            .execute(&mut *transaction)
            .await?;

        // Delete the folder
        let result = sqlx::query("DELETE FROM folders WHERE id = ?")
            .bind(folder_id)
            .execute(&mut *transaction)
            .await?;

        transaction.commit().await?;

        if result.rows_affected() > 0 {
            info!("Deleted folder: {}", folder_id);
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Get meetings count in a folder
    pub async fn get_meeting_count(
        pool: &SqlitePool,
        folder_id: &str,
    ) -> Result<i64, SqlxError> {
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM meetings WHERE folder_id = ?"
        )
        .bind(folder_id)
        .fetch_one(pool)
        .await?;
        Ok(count.0)
    }
}


