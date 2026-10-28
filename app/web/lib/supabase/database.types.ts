export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      board_checkins: {
        Row: {
          at: string;
          battery_mv: number | null;
          board_id: string;
          firmware: string | null;
          id: number;
          result: string;
          rssi: number | null;
        };
        ComputedFields: never;
        Insert: {
          at?: string;
          battery_mv?: number | null;
          board_id: string;
          firmware?: string | null;
          id?: never;
          result: string;
          rssi?: number | null;
        };
        Update: {
          at?: string;
          battery_mv?: number | null;
          board_id?: string;
          firmware?: string | null;
          id?: never;
          result?: string;
          rssi?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "board_checkins_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "boards";
            referencedColumns: ["id"];
          },
        ];
      };
      boards: {
        Row: {
          battery_mv: number | null;
          created_at: string;
          desired_rendition_id: string | null;
          firmware: string | null;
          id: string;
          last_seen_at: string | null;
          name: string;
          panel_type: string;
          rssi: number | null;
          settings: NonNullable<Json>;
          shown_sha256: string | null;
          token_hash: string;
        };
        ComputedFields: never;
        Insert: {
          battery_mv?: number | null;
          created_at?: string;
          desired_rendition_id?: string | null;
          firmware?: string | null;
          id?: string;
          last_seen_at?: string | null;
          name: string;
          panel_type?: string;
          rssi?: number | null;
          settings?: NonNullable<Json>;
          shown_sha256?: string | null;
          token_hash: string;
        };
        Update: {
          battery_mv?: number | null;
          created_at?: string;
          desired_rendition_id?: string | null;
          firmware?: string | null;
          id?: string;
          last_seen_at?: string | null;
          name?: string;
          panel_type?: string;
          rssi?: number | null;
          settings?: NonNullable<Json>;
          shown_sha256?: string | null;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "boards_desired_rendition_id_fkey";
            columns: ["desired_rendition_id"];
            isOneToOne: false;
            referencedRelation: "renditions";
            referencedColumns: ["id"];
          },
        ];
      };
      device_people: {
        Row: {
          device_id: string;
          last_selected_at: string;
          person_id: string;
        };
        ComputedFields: never;
        Insert: {
          device_id: string;
          last_selected_at?: string;
          person_id: string;
        };
        Update: {
          device_id?: string;
          last_selected_at?: string;
          person_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "device_people_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "device_people_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      devices: {
        Row: {
          first_seen_at: string;
          id: string;
          label: string | null;
          last_seen_at: string;
        };
        ComputedFields: never;
        Insert: {
          first_seen_at?: string;
          id: string;
          label?: string | null;
          last_seen_at?: string;
        };
        Update: {
          first_seen_at?: string;
          id?: string;
          label?: string | null;
          last_seen_at?: string;
        };
        Relationships: [];
      };
      displays: {
        Row: {
          board_id: string;
          device_id: string | null;
          id: string;
          rendition_id: string;
          sent_at: string;
          sent_by: string | null;
          shown_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          board_id: string;
          device_id?: string | null;
          id?: string;
          rendition_id: string;
          sent_at?: string;
          sent_by?: string | null;
          shown_at?: string | null;
        };
        Update: {
          board_id?: string;
          device_id?: string | null;
          id?: string;
          rendition_id?: string;
          sent_at?: string;
          sent_by?: string | null;
          shown_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "displays_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "boards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "displays_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "displays_rendition_id_fkey";
            columns: ["rendition_id"];
            isOneToOne: false;
            referencedRelation: "renditions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "displays_sent_by_fkey";
            columns: ["sent_by"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      drawings: {
        Row: {
          artist_id: string;
          created_at: string;
          device_id: string;
          id: string;
          parent_drawing_id: string | null;
          sketch_path: string;
          strokes: NonNullable<Json>;
          title: string | null;
        };
        ComputedFields: never;
        Insert: {
          artist_id: string;
          created_at?: string;
          device_id: string;
          id?: string;
          parent_drawing_id?: string | null;
          sketch_path: string;
          strokes: NonNullable<Json>;
          title?: string | null;
        };
        Update: {
          artist_id?: string;
          created_at?: string;
          device_id?: string;
          id?: string;
          parent_drawing_id?: string | null;
          sketch_path?: string;
          strokes?: NonNullable<Json>;
          title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "drawings_artist_id_fkey";
            columns: ["artist_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "drawings_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "drawings_parent_drawing_id_fkey";
            columns: ["parent_drawing_id"];
            isOneToOne: false;
            referencedRelation: "drawings";
            referencedColumns: ["id"];
          },
        ];
      };
      generations: {
        Row: {
          created_at: string;
          drawing_id: string;
          error: string | null;
          finished_at: string | null;
          id: string;
          image_path: string | null;
          model: string;
          preset_id: string;
          preset_version: number;
          preview_path: string | null;
          prompt: string;
          signed_path: string | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["generation_status"];
          thumb_path: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          drawing_id: string;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          image_path?: string | null;
          model: string;
          preset_id: string;
          preset_version: number;
          preview_path?: string | null;
          prompt: string;
          signed_path?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["generation_status"];
          thumb_path?: string | null;
        };
        Update: {
          created_at?: string;
          drawing_id?: string;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          image_path?: string | null;
          model?: string;
          preset_id?: string;
          preset_version?: number;
          preview_path?: string | null;
          prompt?: string;
          signed_path?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["generation_status"];
          thumb_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "generations_drawing_id_fkey";
            columns: ["drawing_id"];
            isOneToOne: false;
            referencedRelation: "drawings";
            referencedColumns: ["id"];
          },
        ];
      };
      people: {
        Row: {
          created_at: string;
          created_by_device_id: string;
          id: string;
          last_active_at: string;
          name: string;
          signature_strokes: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by_device_id: string;
          id?: string;
          last_active_at?: string;
          name: string;
          signature_strokes: NonNullable<Json>;
        };
        Update: {
          created_at?: string;
          created_by_device_id?: string;
          id?: string;
          last_active_at?: string;
          name?: string;
          signature_strokes?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: "people_created_by_device_id_fkey";
            columns: ["created_by_device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
        ];
      };
      renditions: {
        Row: {
          bytes: number;
          created_at: string;
          generation_id: string | null;
          id: string;
          panel_type: string;
          path: string;
          settings_hash: string;
          sha256: string;
          source_path: string;
        };
        ComputedFields: never;
        Insert: {
          bytes: number;
          created_at?: string;
          generation_id?: string | null;
          id?: string;
          panel_type: string;
          path: string;
          settings_hash: string;
          sha256: string;
          source_path: string;
        };
        Update: {
          bytes?: number;
          created_at?: string;
          generation_id?: string | null;
          id?: string;
          panel_type?: string;
          path?: string;
          settings_hash?: string;
          sha256?: string;
          source_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "renditions_generation_id_fkey";
            columns: ["generation_id"];
            isOneToOne: false;
            referencedRelation: "generations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      generation_status: "pending" | "running" | "succeeded" | "failed";
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      generation_status: ["pending", "running", "succeeded", "failed"],
    },
  },
} as const;
