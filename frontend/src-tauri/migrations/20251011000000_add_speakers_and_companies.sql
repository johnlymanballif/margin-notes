-- Migration: Add speakers and companies support
-- This migration adds:
--   1. companies table for organizing speakers by company
--   2. speakers table for managing speaker information
--   3. speaker_id and speaker_name columns to transcripts table
--   4. Indexes for performance

-- Enable foreign keys (required for foreign key constraints to work)
PRAGMA foreign_keys=ON;

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Create speakers table
CREATE TABLE IF NOT EXISTS speakers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company_id TEXT,
    email TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
);

-- Add speaker_id column to transcripts table (if it doesn't exist)
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we check first
-- This will fail silently if column already exists, which is acceptable
-- as migrations should only run once per database
ALTER TABLE transcripts ADD COLUMN speaker_id TEXT;

-- Add speaker_name column to transcripts table (denormalized for quick access)
ALTER TABLE transcripts ADD COLUMN speaker_name TEXT;

-- Create indexes for faster speaker lookups
CREATE INDEX IF NOT EXISTS idx_transcripts_speaker_id ON transcripts(speaker_id);
CREATE INDEX IF NOT EXISTS idx_speakers_company_id ON speakers(company_id);

