-- Tabela para múltiplos templates de estilo
CREATE TABLE public.style_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.style_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own style templates" 
ON public.style_templates 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own style templates" 
ON public.style_templates 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own style templates" 
ON public.style_templates 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own style templates" 
ON public.style_templates 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add preferred_voice column to ai_settings for favorite voice
ALTER TABLE public.ai_settings ADD COLUMN IF NOT EXISTS preferred_voice TEXT;