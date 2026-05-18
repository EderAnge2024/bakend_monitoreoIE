-- =========================================
-- MIGRATION: 006 - Add Password Reset tokens
-- =========================================

ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;
