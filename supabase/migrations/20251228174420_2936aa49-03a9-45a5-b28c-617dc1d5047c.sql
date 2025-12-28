-- Adicionar coluna google_cookie para armazenar o cookie do Google Labs
ALTER TABLE public.ai_settings 
ADD COLUMN IF NOT EXISTS google_cookie text;