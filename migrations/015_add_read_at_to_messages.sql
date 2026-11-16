-- Migration 015: Add read_at column to messages table for read receipts
-- This enables unread message tracking in conversations

ALTER TABLE messages ADD COLUMN read_at TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_read_at ON messages(read_at);