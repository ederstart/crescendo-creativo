-- Drop the old check constraint
ALTER TABLE public.scripts DROP CONSTRAINT scripts_status_check;

-- Add new check constraint with additional status values
ALTER TABLE public.scripts ADD CONSTRAINT scripts_status_check 
CHECK (status::text = ANY (ARRAY['draft'::text, 'in_progress'::text, 'completed'::text, 'done'::text, 'transcription'::text, 'traduzir'::text]));