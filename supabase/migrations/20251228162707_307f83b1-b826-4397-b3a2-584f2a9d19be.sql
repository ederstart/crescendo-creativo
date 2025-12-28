-- Add style_template column to ai_settings for storing user's preferred image generation style
ALTER TABLE public.ai_settings 
ADD COLUMN style_template text;