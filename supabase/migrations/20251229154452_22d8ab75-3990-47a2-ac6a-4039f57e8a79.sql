-- Tabela para vozes salvas
CREATE TABLE public.voice_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  voice_id TEXT NOT NULL,
  voice_name TEXT NOT NULL,
  description TEXT,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para áudios gerados
CREATE TABLE public.generated_audios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  voice_preset_id UUID REFERENCES public.voice_presets(id) ON DELETE SET NULL,
  text_content TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  model_used TEXT DEFAULT 'eleven_multilingual_v2',
  duration_seconds FLOAT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para ideias de roteiros
CREATE TABLE public.script_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar campo preferred_claude_model em ai_settings
ALTER TABLE public.ai_settings 
ADD COLUMN IF NOT EXISTS preferred_claude_model TEXT DEFAULT 'claude-sonnet-4-5';

-- RLS para voice_presets
ALTER TABLE public.voice_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own voice_presets" 
  ON public.voice_presets FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own voice_presets" 
  ON public.voice_presets FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own voice_presets" 
  ON public.voice_presets FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own voice_presets" 
  ON public.voice_presets FOR DELETE 
  USING (auth.uid() = user_id);

-- RLS para generated_audios
ALTER TABLE public.generated_audios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own generated_audios" 
  ON public.generated_audios FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own generated_audios" 
  ON public.generated_audios FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own generated_audios" 
  ON public.generated_audios FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own generated_audios" 
  ON public.generated_audios FOR DELETE 
  USING (auth.uid() = user_id);

-- RLS para script_ideas
ALTER TABLE public.script_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own script_ideas" 
  ON public.script_ideas FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own script_ideas" 
  ON public.script_ideas FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own script_ideas" 
  ON public.script_ideas FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own script_ideas" 
  ON public.script_ideas FOR DELETE 
  USING (auth.uid() = user_id);