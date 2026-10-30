export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        { id: string; display_name: string },
        { id: string; display_name?: string }
      >;
      workspaces: Table<
        { id: string; name: string; created_at: string },
        { id?: string; name: string; created_at?: string }
      >;
      memberships: Table<
        {
          workspace_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["membership_role"];
          created_at: string;
        },
        {
          workspace_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["membership_role"];
          created_at?: string;
        }
      >;
      projects: Table<
        {
          id: string;
          workspace_id: string;
          name: string;
          registration: string;
          status: "active" | "maintenance" | "inactive";
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          name: string;
          registration: string;
          status?: "active" | "maintenance" | "inactive";
          created_at?: string;
          updated_at?: string;
        }
      >;
      notes: Table<
        {
          id: string;
          workspace_id: string;
          project_id: string;
          body: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          project_id: string;
          body: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      project_summaries: Table<
        {
          project_id: string;
          workspace_id: string;
          summary: string;
          key_points: Json;
          provider: string;
          generated_at: string;
        },
        {
          project_id: string;
          workspace_id: string;
          summary: string;
          key_points: Json;
          provider?: string;
          generated_at?: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      has_workspace_role: {
        Args: {
          p_workspace_id: string;
          p_minimum_role: Database["public"]["Enums"]["membership_role"];
        };
        Returns: boolean;
      };
      invite_workspace_member: {
        Args: {
          p_workspace_id: string;
          p_email: string;
          p_role: Database["public"]["Enums"]["membership_role"];
        };
        Returns: boolean;
      };
    };
    Enums: {
      membership_role: "owner" | "editor" | "viewer";
    };
    CompositeTypes: Record<string, never>;
  };
};
