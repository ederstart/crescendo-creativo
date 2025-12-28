-- Make project_id nullable in scripts table
ALTER TABLE public.scripts ALTER COLUMN project_id DROP NOT NULL;