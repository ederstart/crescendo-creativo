-- CRESCER YOUTUBE Database Schema
-- Execute this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scripts table
CREATE TABLE IF NOT EXISTS scripts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT DEFAULT '',
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- References table (video references for scripts)
CREATE TABLE IF NOT EXISTS references (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  script_id UUID REFERENCES scripts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  title VARCHAR(255),
  thumbnail_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mood boards table
CREATE TABLE IF NOT EXISTS mood_boards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) DEFAULT 'general' CHECK (type IN ('thumbnail', 'general')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mood board items (images with position like PureRef)
CREATE TABLE IF NOT EXISTS mood_board_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  mood_board_id UUID REFERENCES mood_boards(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  position_x FLOAT DEFAULT 0,
  position_y FLOAT DEFAULT 0,
  width FLOAT DEFAULT 200,
  height FLOAT DEFAULT 150,
  z_index INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Script thumbnails (link scripts to thumbnails)
CREATE TABLE IF NOT EXISTS script_thumbnails (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  script_id UUID REFERENCES scripts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  thumbnail_url TEXT NOT NULL,
  is_selected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security Policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE references ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_board_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_thumbnails ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE USING (auth.uid() = user_id);

-- Scripts policies
CREATE POLICY "Users can view own scripts" ON scripts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scripts" ON scripts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scripts" ON scripts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scripts" ON scripts
  FOR DELETE USING (auth.uid() = user_id);

-- References policies
CREATE POLICY "Users can view own references" ON references
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own references" ON references
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own references" ON references
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own references" ON references
  FOR DELETE USING (auth.uid() = user_id);

-- Mood boards policies
CREATE POLICY "Users can view own mood_boards" ON mood_boards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mood_boards" ON mood_boards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mood_boards" ON mood_boards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own mood_boards" ON mood_boards
  FOR DELETE USING (auth.uid() = user_id);

-- Mood board items policies
CREATE POLICY "Users can view own mood_board_items" ON mood_board_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mood_board_items" ON mood_board_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mood_board_items" ON mood_board_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own mood_board_items" ON mood_board_items
  FOR DELETE USING (auth.uid() = user_id);

-- Script thumbnails policies
CREATE POLICY "Users can view own script_thumbnails" ON script_thumbnails
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own script_thumbnails" ON script_thumbnails
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own script_thumbnails" ON script_thumbnails
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own script_thumbnails" ON script_thumbnails
  FOR DELETE USING (auth.uid() = user_id);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scripts_updated_at BEFORE UPDATE ON scripts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mood_boards_updated_at BEFORE UPDATE ON mood_boards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mood_board_items_updated_at BEFORE UPDATE ON mood_board_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
