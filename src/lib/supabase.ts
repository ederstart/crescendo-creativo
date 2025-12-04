import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qmvctgyletddzwozxtqz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtdmN0Z3lsZXRkZHp3b3p4dHF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4ODMyMzMsImV4cCI6MjA4MDQ1OTIzM30.9rBBuNv_Yy9HH-UteWUKNU-c46xkPkgPDIVwm181_RU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
