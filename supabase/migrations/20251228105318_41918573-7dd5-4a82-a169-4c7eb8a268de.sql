-- Add openrouter_api_key column to ai_settings
ALTER TABLE public.ai_settings
ADD COLUMN openrouter_api_key TEXT;