-- Create table for AI settings (API keys per user)
CREATE TABLE public.ai_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  groq_api_key TEXT,
  gemini_api_key TEXT,
  whisk_token TEXT,
  whisk_session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create table for prompt templates
CREATE TABLE public.prompt_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('script', 'scene')),
  content TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for generated images
CREATE TABLE public.generated_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  script_id UUID REFERENCES public.scripts(id) ON DELETE CASCADE,
  scene_description TEXT,
  prompt_used TEXT,
  image_url TEXT NOT NULL,
  subject_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for AI generation sessions
CREATE TABLE public.ai_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('script', 'scene')),
  input_content TEXT,
  output_content TEXT,
  model_used TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_settings
CREATE POLICY "Users can view their own AI settings" 
ON public.ai_settings FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own AI settings" 
ON public.ai_settings FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI settings" 
ON public.ai_settings FOR UPDATE 
USING (auth.uid() = user_id);

-- RLS policies for prompt_templates
CREATE POLICY "Users can view their own prompt templates" 
ON public.prompt_templates FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own prompt templates" 
ON public.prompt_templates FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own prompt templates" 
ON public.prompt_templates FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own prompt templates" 
ON public.prompt_templates FOR DELETE 
USING (auth.uid() = user_id);

-- RLS policies for generated_images
CREATE POLICY "Users can view their own generated images" 
ON public.generated_images FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own generated images" 
ON public.generated_images FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own generated images" 
ON public.generated_images FOR DELETE 
USING (auth.uid() = user_id);

-- RLS policies for ai_sessions
CREATE POLICY "Users can view their own AI sessions" 
ON public.ai_sessions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own AI sessions" 
ON public.ai_sessions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_ai_settings_updated_at
BEFORE UPDATE ON public.ai_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prompt_templates_updated_at
BEFORE UPDATE ON public.prompt_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();