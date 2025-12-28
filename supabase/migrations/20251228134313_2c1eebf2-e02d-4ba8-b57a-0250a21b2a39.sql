-- Create subtitles table for SRT storage
CREATE TABLE public.subtitles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_script_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subtitles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own subtitles"
ON public.subtitles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own subtitles"
ON public.subtitles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subtitles"
ON public.subtitles
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own subtitles"
ON public.subtitles
FOR UPDATE
USING (auth.uid() = user_id);