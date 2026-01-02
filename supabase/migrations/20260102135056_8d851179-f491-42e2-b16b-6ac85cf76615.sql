-- Add claude_cookie column to ai_settings
ALTER TABLE public.ai_settings 
ADD COLUMN IF NOT EXISTS claude_cookie TEXT;