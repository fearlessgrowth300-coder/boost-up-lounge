export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      activity: {
        Row: {
          channel_id: string | null;
          country: string | null;
          created_at: string;
          event_type: string;
          id: string;
          platform: string | null;
          user_id: string | null;
        };
        Insert: {
          channel_id?: string | null;
          country?: string | null;
          created_at?: string;
          event_type: string;
          id?: string;
          platform?: string | null;
          user_id?: string | null;
        };
        Update: {
          channel_id?: string | null;
          country?: string | null;
          created_at?: string;
          event_type?: string;
          id?: string;
          platform?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "activity_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
        ];
      };
      channels: {
        Row: {
          ai_insights: Json;
          avatar_url: string | null;
          banner_url: string | null;
          broadcaster_type: string | null;
          channel_url: string;
          created_at: string;
          current_category: string | null;
          current_title: string | null;
          description: string | null;
          followers: number;
          id: string;
          is_live: boolean;
          last_checked_at: string | null;
          platform: string;
          recent_categories: Json;
          recent_videos: Json;
          schedule_segments: Json;
          schedule_vacation: Json | null;
          updated_at: string;
          user_id: string;
          username: string;
          verified: boolean;
          viewer_count: number;
        };
        Insert: {
          ai_insights?: Json;
          avatar_url?: string | null;
          banner_url?: string | null;
          broadcaster_type?: string | null;
          channel_url: string;
          created_at?: string;
          current_category?: string | null;
          current_title?: string | null;
          description?: string | null;
          followers?: number;
          id?: string;
          is_live?: boolean;
          last_checked_at?: string | null;
          platform?: string;
          recent_categories?: Json;
          recent_videos?: Json;
          schedule_segments?: Json;
          schedule_vacation?: Json | null;
          updated_at?: string;
          user_id: string;
          username: string;
          verified?: boolean;
          viewer_count?: number;
        };
        Update: {
          ai_insights?: Json;
          avatar_url?: string | null;
          banner_url?: string | null;
          broadcaster_type?: string | null;
          channel_url?: string;
          created_at?: string;
          current_category?: string | null;
          current_title?: string | null;
          description?: string | null;
          followers?: number;
          id?: string;
          is_live?: boolean;
          last_checked_at?: string | null;
          platform?: string;
          recent_categories?: Json;
          recent_videos?: Json;
          schedule_segments?: Json;
          schedule_vacation?: Json | null;
          updated_at?: string;
          user_id?: string;
          username?: string;
          verified?: boolean;
          viewer_count?: number;
        };
        Relationships: [];
      };
      channel_snapshots: {
        Row: {
          channel_id: string;
          followers: number;
          health_score: number;
          id: string;
          is_live: boolean;
          issue_count: number;
          recent_broadcasts: number;
          recorded_at: string;
          user_id: string;
          viewer_count: number;
        };
        Insert: {
          channel_id: string;
          followers?: number;
          health_score?: number;
          id?: string;
          is_live?: boolean;
          issue_count?: number;
          recent_broadcasts?: number;
          recorded_at?: string;
          user_id: string;
          viewer_count?: number;
        };
        Update: {
          channel_id?: string;
          followers?: number;
          health_score?: number;
          id?: string;
          is_live?: boolean;
          issue_count?: number;
          recent_broadcasts?: number;
          recorded_at?: string;
          user_id?: string;
          viewer_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "channel_snapshots_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
        ];
      };
      channel_issue_progress: {
        Row: {
          channel_id: string;
          completed: boolean;
          completed_at: string | null;
          evidence_url: string | null;
          id: string;
          issue_id: string;
          notes: string | null;
          target_date: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          channel_id: string;
          completed?: boolean;
          completed_at?: string | null;
          evidence_url?: string | null;
          id?: string;
          issue_id: string;
          notes?: string | null;
          target_date?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          channel_id?: string;
          completed?: boolean;
          completed_at?: string | null;
          evidence_url?: string | null;
          id?: string;
          issue_id?: string;
          notes?: string | null;
          target_date?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      channel_workspace: {
        Row: {
          channel_id: string;
          follow_up_at: string | null;
          monitoring_enabled: boolean;
          owner_notes: string | null;
          tags: string[];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          channel_id: string;
          follow_up_at?: string | null;
          monitoring_enabled?: boolean;
          owner_notes?: string | null;
          tags?: string[];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          channel_id?: string;
          follow_up_at?: string | null;
          monitoring_enabled?: boolean;
          owner_notes?: string | null;
          tags?: string[];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      campaign_tokens: {
        Row: {
          activated_at: string | null;
          channel_id: string;
          fiverr_order_reference: string | null;
          id: string;
          issued_at: string;
          payment_verified_at: string | null;
          payment_verified_by: string | null;
          revoked_at: string | null;
          revocation_reason: string | null;
          status: string;
          token_hash: string;
          token_preview: string;
          user_id: string;
        };
        Insert: {
          activated_at?: string | null;
          channel_id: string;
          fiverr_order_reference?: string | null;
          id?: string;
          issued_at?: string;
          payment_verified_at?: string | null;
          payment_verified_by?: string | null;
          revoked_at?: string | null;
          revocation_reason?: string | null;
          status?: string;
          token_hash: string;
          token_preview: string;
          user_id: string;
        };
        Update: {
          activated_at?: string | null;
          channel_id?: string;
          fiverr_order_reference?: string | null;
          id?: string;
          issued_at?: string;
          payment_verified_at?: string | null;
          payment_verified_by?: string | null;
          revoked_at?: string | null;
          revocation_reason?: string | null;
          status?: string;
          token_hash?: string;
          token_preview?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      clicks: {
        Row: {
          browser: string | null;
          channel_id: string;
          converted: boolean;
          country: string | null;
          country_code: string | null;
          created_at: string;
          device_type: string | null;
          id: string;
          language: string | null;
          operating_system: string | null;
          referrer: string | null;
          source_domain: string | null;
          user_agent: string | null;
        };
        Insert: {
          browser?: string | null;
          channel_id: string;
          converted?: boolean;
          country?: string | null;
          country_code?: string | null;
          created_at?: string;
          device_type?: string | null;
          id?: string;
          language?: string | null;
          operating_system?: string | null;
          referrer?: string | null;
          source_domain?: string | null;
          user_agent?: string | null;
        };
        Update: {
          browser?: string | null;
          channel_id?: string;
          converted?: boolean;
          country?: string | null;
          country_code?: string | null;
          created_at?: string;
          device_type?: string | null;
          id?: string;
          language?: string | null;
          operating_system?: string | null;
          referrer?: string | null;
          source_domain?: string | null;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "clicks_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      activate_campaign_token: {
        Args: { p_channel_id: string; p_token_hash: string };
        Returns: string;
      };
      record_promo_click: {
        Args: {
          p_browser?: string | null;
          p_channel_id: string;
          p_country?: string | null;
          p_country_code?: string | null;
          p_device_type?: string | null;
          p_language?: string | null;
          p_operating_system?: string | null;
          p_referrer?: string | null;
          p_source_domain?: string | null;
          p_user_agent?: string | null;
        };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
