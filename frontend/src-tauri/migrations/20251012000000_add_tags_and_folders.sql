-- Migration: Add tags and folders support for meeting organization
-- This migration adds:
--   1. folders table for organizing meetings into categories
--   2. tags table for labeling meetings
--   3. meeting_tags junction table for many-to-many relationship
--   4. folder_id column to meetings table
--   5. Indexes for performance

-- Enable foreign keys
PRAGMA foreign_keys=ON;

-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT, -- Optional color for visual organization (hex color code)
    parent_id TEXT, -- For nested folders (NULL for root folders)
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL
);

-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT, -- Optional color for visual organization (hex color code)
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Create meeting_tags junction table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS meeting_tags (
    meeting_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    PRIMARY KEY (meeting_id, tag_id),
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Add folder_id column to meetings table
-- Note: SQLite doesn't support adding foreign key constraints via ALTER TABLE
-- The foreign key relationship is enforced at the application level
ALTER TABLE meetings ADD COLUMN folder_id TEXT;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_meetings_folder_id ON meetings(folder_id);
CREATE INDEX IF NOT EXISTS idx_meeting_tags_meeting_id ON meeting_tags(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_tags_tag_id ON meeting_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);

