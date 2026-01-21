-- Add column to store second image variation from Whisk
ALTER TABLE generated_images ADD COLUMN IF NOT EXISTS alternate_image_url TEXT;