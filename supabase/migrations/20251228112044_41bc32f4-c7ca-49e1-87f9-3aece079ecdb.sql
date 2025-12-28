-- Add preferred AI model columns for each section
ALTER TABLE public.ai_settings 
ADD COLUMN IF NOT EXISTS preferred_model_script text DEFAULT 'groq',
ADD COLUMN IF NOT EXISTS preferred_model_scene text DEFAULT 'groq',
ADD COLUMN IF NOT EXISTS preferred_model_image text DEFAULT 'whisk';