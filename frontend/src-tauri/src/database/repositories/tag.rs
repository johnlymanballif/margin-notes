use crate::database::models::Tag;
use sqlx::{Error as SqlxError, SqlitePool};
use tracing::info;
use uuid::Uuid;

pub struct TagsRepository;

impl TagsRepository {
    /// Get all tags
    pub async fn get_all_tags(pool: &SqlitePool) -> Result<Vec<Tag>, SqlxError> {
        let tags = sqlx::query_as::<_, Tag>(
            "SELECT id, name, color, created_at, updated_at FROM tags ORDER BY name"
        )
        .fetch_all(pool)
        .await?;
        Ok(tags)
    }

    /// Get a tag by ID
    pub async fn get_tag_by_id(pool: &SqlitePool, tag_id: &str) -> Result<Option<Tag>, SqlxError> {
        let tag = sqlx::query_as::<_, Tag>(
            "SELECT id, name, color, created_at, updated_at FROM tags WHERE id = ?"
        )
        .bind(tag_id)
        .fetch_optional(pool)
        .await?;
        Ok(tag)
    }

    /// Create a new tag
    pub async fn create_tag(
        pool: &SqlitePool,
        name: &str,
        color: Option<&str>,
    ) -> Result<Tag, SqlxError> {
        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now();

        sqlx::query(
            "INSERT INTO tags (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(name)
        .bind(color)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;

        let tag = sqlx::query_as::<_, Tag>(
            "SELECT id, name, color, created_at, updated_at FROM tags WHERE id = ?"
        )
        .bind(&id)
        .fetch_one(pool)
        .await?;

        info!("Created tag: {} ({})", name, id);
        Ok(tag)
    }

    /// Update a tag
    pub async fn update_tag(
        pool: &SqlitePool,
        tag_id: &str,
        name: &str,
        color: Option<&str>,
    ) -> Result<Tag, SqlxError> {
        let now = chrono::Utc::now();

        sqlx::query(
            "UPDATE tags SET name = ?, color = ?, updated_at = ? WHERE id = ?"
        )
        .bind(name)
        .bind(color)
        .bind(now)
        .bind(tag_id)
        .execute(pool)
        .await?;

        let tag = sqlx::query_as::<_, Tag>(
            "SELECT id, name, color, created_at, updated_at FROM tags WHERE id = ?"
        )
        .bind(tag_id)
        .fetch_one(pool)
        .await?;

        info!("Updated tag: {} ({})", name, tag_id);
        Ok(tag)
    }

    /// Delete a tag
    pub async fn delete_tag(pool: &SqlitePool, tag_id: &str) -> Result<bool, SqlxError> {
        let result = sqlx::query("DELETE FROM tags WHERE id = ?")
            .bind(tag_id)
            .execute(pool)
            .await?;

        if result.rows_affected() > 0 {
            info!("Deleted tag: {}", tag_id);
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Get tags for a specific meeting
    pub async fn get_meeting_tags(
        pool: &SqlitePool,
        meeting_id: &str,
    ) -> Result<Vec<Tag>, SqlxError> {
        let tags = sqlx::query_as::<_, Tag>(
            r#"
            SELECT t.id, t.name, t.color, t.created_at, t.updated_at
            FROM tags t
            INNER JOIN meeting_tags mt ON t.id = mt.tag_id
            WHERE mt.meeting_id = ?
            ORDER BY t.name
            "#
        )
        .bind(meeting_id)
        .fetch_all(pool)
        .await?;
        Ok(tags)
    }

    /// Add a tag to a meeting
    pub async fn add_tag_to_meeting(
        pool: &SqlitePool,
        meeting_id: &str,
        tag_id: &str,
    ) -> Result<(), SqlxError> {
        let now = chrono::Utc::now();

        sqlx::query(
            "INSERT OR IGNORE INTO meeting_tags (meeting_id, tag_id, created_at) VALUES (?, ?, ?)"
        )
        .bind(meeting_id)
        .bind(tag_id)
        .bind(now)
        .execute(pool)
        .await?;

        info!("Added tag {} to meeting {}", tag_id, meeting_id);
        Ok(())
    }

    /// Remove a tag from a meeting
    pub async fn remove_tag_from_meeting(
        pool: &SqlitePool,
        meeting_id: &str,
        tag_id: &str,
    ) -> Result<bool, SqlxError> {
        let result = sqlx::query(
            "DELETE FROM meeting_tags WHERE meeting_id = ? AND tag_id = ?"
        )
        .bind(meeting_id)
        .bind(tag_id)
        .execute(pool)
        .await?;

        if result.rows_affected() > 0 {
            info!("Removed tag {} from meeting {}", tag_id, meeting_id);
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Set tags for a meeting (replaces all existing tags)
    pub async fn set_meeting_tags(
        pool: &SqlitePool,
        meeting_id: &str,
        tag_ids: &[String],
    ) -> Result<(), SqlxError> {
        let mut transaction = pool.begin().await?;

        // Remove all existing tags
        sqlx::query("DELETE FROM meeting_tags WHERE meeting_id = ?")
            .bind(meeting_id)
            .execute(&mut *transaction)
            .await?;

        // Add new tags
        let now = chrono::Utc::now();
        for tag_id in tag_ids {
            sqlx::query(
                "INSERT INTO meeting_tags (meeting_id, tag_id, created_at) VALUES (?, ?, ?)"
            )
            .bind(meeting_id)
            .bind(tag_id)
            .bind(now)
            .execute(&mut *transaction)
            .await?;
        }

        transaction.commit().await?;
        info!("Set {} tags for meeting {}", tag_ids.len(), meeting_id);
        Ok(())
    }
}


