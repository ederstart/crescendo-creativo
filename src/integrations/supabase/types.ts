export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_sessions: {
        Row: {
          created_at: string
          id: string
          input_content: string | null
          model_used: string | null
          output_content: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          input_content?: string | null
          model_used?: string | null
          output_content?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          input_content?: string | null
          model_used?: string | null
          output_content?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_settings: {
        Row: {
          created_at: string
          gemini_api_key: string | null
          google_cookie: string | null
          groq_api_key: string | null
          id: string
          openrouter_api_key: string | null
          preferred_claude_model: string | null
          preferred_model_image: string | null
          preferred_model_scene: string | null
          preferred_model_script: string | null
          style_template: string | null
          updated_at: string
          user_id: string
          whisk_session_id: string | null
          whisk_token: string | null
        }
        Insert: {
          created_at?: string
          gemini_api_key?: string | null
          google_cookie?: string | null
          groq_api_key?: string | null
          id?: string
          openrouter_api_key?: string | null
          preferred_claude_model?: string | null
          preferred_model_image?: string | null
          preferred_model_scene?: string | null
          preferred_model_script?: string | null
          style_template?: string | null
          updated_at?: string
          user_id: string
          whisk_session_id?: string | null
          whisk_token?: string | null
        }
        Update: {
          created_at?: string
          gemini_api_key?: string | null
          google_cookie?: string | null
          groq_api_key?: string | null
          id?: string
          openrouter_api_key?: string | null
          preferred_claude_model?: string | null
          preferred_model_image?: string | null
          preferred_model_scene?: string | null
          preferred_model_script?: string | null
          style_template?: string | null
          updated_at?: string
          user_id?: string
          whisk_session_id?: string | null
          whisk_token?: string | null
        }
        Relationships: []
      }
      generated_audios: {
        Row: {
          audio_url: string
          created_at: string | null
          duration_seconds: number | null
          id: string
          model_used: string | null
          text_content: string
          user_id: string
          voice_preset_id: string | null
        }
        Insert: {
          audio_url: string
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          model_used?: string | null
          text_content: string
          user_id: string
          voice_preset_id?: string | null
        }
        Update: {
          audio_url?: string
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          model_used?: string | null
          text_content?: string
          user_id?: string
          voice_preset_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_audios_voice_preset_id_fkey"
            columns: ["voice_preset_id"]
            isOneToOne: false
            referencedRelation: "voice_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          prompt_used: string | null
          scene_description: string | null
          script_id: string | null
          subject_image_url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          prompt_used?: string | null
          scene_description?: string | null
          script_id?: string | null
          subject_image_url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          prompt_used?: string | null
          scene_description?: string | null
          script_id?: string | null
          subject_image_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_images_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      mood_board_items: {
        Row: {
          created_at: string | null
          height: number | null
          id: string
          image_url: string
          mood_board_id: string
          notes: string | null
          position_x: number | null
          position_y: number | null
          updated_at: string | null
          user_id: string
          width: number | null
          z_index: number | null
        }
        Insert: {
          created_at?: string | null
          height?: number | null
          id?: string
          image_url: string
          mood_board_id: string
          notes?: string | null
          position_x?: number | null
          position_y?: number | null
          updated_at?: string | null
          user_id: string
          width?: number | null
          z_index?: number | null
        }
        Update: {
          created_at?: string | null
          height?: number | null
          id?: string
          image_url?: string
          mood_board_id?: string
          notes?: string | null
          position_x?: number | null
          position_y?: number | null
          updated_at?: string | null
          user_id?: string
          width?: number | null
          z_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mood_board_items_mood_board_id_fkey"
            columns: ["mood_board_id"]
            isOneToOne: false
            referencedRelation: "mood_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      mood_boards: {
        Row: {
          created_at: string | null
          id: string
          name: string
          project_id: string | null
          type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          project_id?: string | null
          type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          project_id?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mood_boards_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      prompt_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      script_ideas: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          priority: number | null
          status: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          priority?: number | null
          status?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          priority?: number | null
          status?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      script_thumbnails: {
        Row: {
          created_at: string | null
          id: string
          is_selected: boolean | null
          script_id: string
          thumbnail_url: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_selected?: boolean | null
          script_id: string
          thumbnail_url: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_selected?: boolean | null
          script_id?: string
          thumbnail_url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "script_thumbnails_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          project_id: string | null
          status: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          project_id?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          project_id?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scripts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      subtitles: {
        Row: {
          content: string
          created_at: string
          id: string
          source_script_ids: string[] | null
          title: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          source_script_ids?: string[] | null
          title: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          source_script_ids?: string[] | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      video_references: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          script_id: string
          thumbnail_url: string | null
          title: string | null
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          script_id: string
          thumbnail_url?: string | null
          title?: string | null
          url: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          script_id?: string
          thumbnail_url?: string | null
          title?: string | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_references_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_presets: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_favorite: boolean | null
          user_id: string
          voice_id: string
          voice_name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_favorite?: boolean | null
          user_id: string
          voice_id: string
          voice_name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_favorite?: boolean | null
          user_id?: string
          voice_id?: string
          voice_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
