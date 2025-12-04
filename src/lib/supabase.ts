import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      scripts: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          title: string;
          content: string;
          status: 'draft' | 'in_progress' | 'completed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          title: string;
          content?: string;
          status?: 'draft' | 'in_progress' | 'completed';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          title?: string;
          content?: string;
          status?: 'draft' | 'in_progress' | 'completed';
          created_at?: string;
          updated_at?: string;
        };
      };
      references: {
        Row: {
          id: string;
          script_id: string;
          user_id: string;
          url: string;
          title: string | null;
          thumbnail_url: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          script_id: string;
          user_id: string;
          url: string;
          title?: string | null;
          thumbnail_url?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          script_id?: string;
          user_id?: string;
          url?: string;
          title?: string | null;
          thumbnail_url?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      mood_boards: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          name: string;
          type: 'thumbnail' | 'general';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          name: string;
          type?: 'thumbnail' | 'general';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          name?: string;
          type?: 'thumbnail' | 'general';
          created_at?: string;
          updated_at?: string;
        };
      };
      mood_board_items: {
        Row: {
          id: string;
          mood_board_id: string;
          user_id: string;
          image_url: string;
          position_x: number;
          position_y: number;
          width: number;
          height: number;
          z_index: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          mood_board_id: string;
          user_id: string;
          image_url: string;
          position_x?: number;
          position_y?: number;
          width?: number;
          height?: number;
          z_index?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          mood_board_id?: string;
          user_id?: string;
          image_url?: string;
          position_x?: number;
          position_y?: number;
          width?: number;
          height?: number;
          z_index?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      script_thumbnails: {
        Row: {
          id: string;
          script_id: string;
          user_id: string;
          thumbnail_url: string;
          is_selected: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          script_id: string;
          user_id: string;
          thumbnail_url: string;
          is_selected?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          script_id?: string;
          user_id?: string;
          thumbnail_url?: string;
          is_selected?: boolean;
          created_at?: string;
        };
      };
    };
  };
};
