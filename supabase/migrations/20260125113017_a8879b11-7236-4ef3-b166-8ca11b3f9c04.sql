-- Create table to store batch script generation queue
CREATE TABLE public.script_generation_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  idea_id UUID REFERENCES public.script_ideas(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  prompt TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  generated_content TEXT,
  model_used TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.script_generation_queue ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own queue items"
ON public.script_generation_queue
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own queue items"
ON public.script_generation_queue
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own queue items"
ON public.script_generation_queue
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own queue items"
ON public.script_generation_queue
FOR DELETE
USING (auth.uid() = user_id);

-- Add index for faster querying
CREATE INDEX idx_script_queue_user_status ON public.script_generation_queue(user_id, status);
CREATE INDEX idx_script_queue_created ON public.script_generation_queue(created_at DESC);