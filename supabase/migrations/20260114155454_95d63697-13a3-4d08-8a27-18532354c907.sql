-- First update any 'completed' status to 'done' 
UPDATE public.scripts SET status = 'done' WHERE status = 'completed';

-- Now add the new constraint with 'dialogue'
ALTER TABLE public.scripts DROP CONSTRAINT IF EXISTS scripts_status_check;
ALTER TABLE public.scripts ADD CONSTRAINT scripts_status_check 
  CHECK (status IN ('draft', 'in_progress', 'done', 'transcription', 'traduzir', 'dialogue'));