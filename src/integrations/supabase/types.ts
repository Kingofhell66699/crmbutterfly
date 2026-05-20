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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action_type: string
          created_at: string
          description: string
          id: string
          lead_id: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          description: string
          id?: string
          lead_id?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string
          id?: string
          lead_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_assignments: {
        Row: {
          assigned_by: string
          assigned_to: string
          created_at: string
          from_team: Database["public"]["Enums"]["team_type"] | null
          id: string
          lead_id: string
          to_team: Database["public"]["Enums"]["team_type"] | null
        }
        Insert: {
          assigned_by: string
          assigned_to: string
          created_at?: string
          from_team?: Database["public"]["Enums"]["team_type"] | null
          id?: string
          lead_id: string
          to_team?: Database["public"]["Enums"]["team_type"] | null
        }
        Update: {
          assigned_by?: string
          assigned_to?: string
          created_at?: string
          from_team?: Database["public"]["Enums"]["team_type"] | null
          id?: string
          lead_id?: string
          to_team?: Database["public"]["Enums"]["team_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_imports: {
        Row: {
          created_at: string
          field_mapping: Json | null
          id: string
          imported_by: string
          imported_count: number
          source_name: string | null
          source_type: string
        }
        Insert: {
          created_at?: string
          field_mapping?: Json | null
          id?: string
          imported_by: string
          imported_count?: number
          source_name?: string | null
          source_type: string
        }
        Update: {
          created_at?: string
          field_mapping?: Json | null
          id?: string
          imported_by?: string
          imported_count?: number
          source_name?: string | null
          source_type?: string
        }
        Relationships: []
      }
      lead_notes: {
        Row: {
          author_id: string
          author_team: Database["public"]["Enums"]["team_type"]
          created_at: string
          id: string
          lead_id: string
          note_text: string
        }
        Insert: {
          author_id: string
          author_team: Database["public"]["Enums"]["team_type"]
          created_at?: string
          id?: string
          lead_id: string
          note_text: string
        }
        Update: {
          author_id?: string
          author_team?: Database["public"]["Enums"]["team_type"]
          created_at?: string
          id?: string
          lead_id?: string
          note_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          country: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          interested_status:
            | Database["public"]["Enums"]["interested_status"]
            | null
          last_contact_date: string | null
          next_follow_up_date: string | null
          phone: string | null
          priority: Database["public"]["Enums"]["lead_priority"] | null
          retention_status:
            | Database["public"]["Enums"]["retention_status"]
            | null
          source: string | null
          tags: string[] | null
          team_type: Database["public"]["Enums"]["team_type"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          interested_status?:
            | Database["public"]["Enums"]["interested_status"]
            | null
          last_contact_date?: string | null
          next_follow_up_date?: string | null
          phone?: string | null
          priority?: Database["public"]["Enums"]["lead_priority"] | null
          retention_status?:
            | Database["public"]["Enums"]["retention_status"]
            | null
          source?: string | null
          tags?: string[] | null
          team_type?: Database["public"]["Enums"]["team_type"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          interested_status?:
            | Database["public"]["Enums"]["interested_status"]
            | null
          last_contact_date?: string | null
          next_follow_up_date?: string | null
          phone?: string | null
          priority?: Database["public"]["Enums"]["lead_priority"] | null
          retention_status?:
            | Database["public"]["Enums"]["retention_status"]
            | null
          source?: string | null
          tags?: string[] | null
          team_type?: Database["public"]["Enums"]["team_type"]
          updated_at?: string
        }
        Relationships: []
      }
      partner_api_keys: {
        Row: {
          api_key: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          last_used_at: string | null
          partner_name: string
          permissions: string[]
        }
        Insert: {
          api_key?: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          partner_name: string
          permissions?: string[]
        }
        Update: {
          api_key?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          partner_name?: string
          permissions?: string[]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          team: Database["public"]["Enums"]["team_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          team?: Database["public"]["Enums"]["team_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          team?: Database["public"]["Enums"]["team_type"]
          updated_at?: string
        }
        Relationships: []
      }
      telegram_bot_state: {
        Row: {
          id: number
          update_offset: number
          updated_at: string
        }
        Insert: {
          id: number
          update_offset?: number
          updated_at?: string
        }
        Update: {
          id?: number
          update_offset?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_messages: {
        Row: {
          chat_id: number
          created_at: string
          processed: boolean
          raw_update: Json
          text: string | null
          update_id: number
        }
        Insert: {
          chat_id: number
          created_at?: string
          processed?: boolean
          raw_update: Json
          text?: string | null
          update_id: number
        }
        Update: {
          chat_id?: number
          created_at?: string
          processed?: boolean
          raw_update?: Json
          text?: string | null
          update_id?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_team: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["team_type"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "sales_agent" | "retention_agent"
      interested_status:
        | "interested"
        | "not_interested"
        | "no_answer"
        | "callback_later"
        | "wrong_number"
        | "converted"
        | "not_called"
        | "wrong_info"
        | "hung_up"
      lead_priority: "low" | "medium" | "high"
      retention_status:
        | "new_to_retention"
        | "contacted"
        | "follow_up"
        | "active"
        | "deposited_converted"
        | "lost"
        | "do_not_contact"
      team_type: "sales" | "retention"
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
    Enums: {
      app_role: ["super_admin", "sales_agent", "retention_agent"],
      interested_status: [
        "interested",
        "not_interested",
        "no_answer",
        "callback_later",
        "wrong_number",
        "converted",
        "not_called",
        "wrong_info",
        "hung_up",
      ],
      lead_priority: ["low", "medium", "high"],
      retention_status: [
        "new_to_retention",
        "contacted",
        "follow_up",
        "active",
        "deposited_converted",
        "lost",
        "do_not_contact",
      ],
      team_type: ["sales", "retention"],
    },
  },
} as const
