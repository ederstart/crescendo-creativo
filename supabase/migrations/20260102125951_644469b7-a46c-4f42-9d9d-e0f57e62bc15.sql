-- Add is_archived column to scripts table
ALTER TABLE public.scripts ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_scripts_is_archived ON public.scripts(is_archived);

-- Create table to persist generated scene prompts
CREATE TABLE IF NOT EXISTS public.generated_scene_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  script_id UUID REFERENCES public.scripts(id) ON DELETE CASCADE,
  script_title TEXT NOT NULL,
  prompts JSONB NOT NULL,
  style_prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.generated_scene_prompts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own scene prompts" ON public.generated_scene_prompts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own scene prompts" ON public.generated_scene_prompts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own scene prompts" ON public.generated_scene_prompts
  FOR DELETE USING (auth.uid() = user_id);