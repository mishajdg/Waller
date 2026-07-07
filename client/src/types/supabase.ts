/**
 * Supabase Database Types — wygenerowane na podstawie schematu
 * =============================================================
 * Te typy odzwierciedlają strukturę tabel w Supabase.
 * W przyszłości możesz je regenerować automatycznie:
 *   npx supabase gen types typescript --project-id <id> > src/types/supabase.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      gyms: {
        Row: {
          id: string;
          name: string;
          slug: string;
          map_width: number;
          map_height: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          map_width?: number;
          map_height?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          map_width?: number;
          map_height?: number;
          updated_at?: string;
        };
      };
      sectors: {
        Row: {
          id: string;
          gym_id: string;
          code: string;
          name: string;
          short_name: string;
          polygon: Json;
          label: Json;
          fill: string;
          setting_date: string | null;
          removal_date: string | null;
          author: string;
          description: string;
          highlight: "new" | "removal" | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          gym_id: string;
          code: string;
          name: string;
          short_name: string;
          polygon?: Json;
          label?: Json;
          fill?: string;
          setting_date?: string | null;
          removal_date?: string | null;
          author?: string;
          description?: string;
          highlight?: "new" | "removal" | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          gym_id?: string;
          code?: string;
          name?: string;
          short_name?: string;
          polygon?: Json;
          label?: Json;
          fill?: string;
          setting_date?: string | null;
          removal_date?: string | null;
          author?: string;
          description?: string;
          highlight?: "new" | "removal" | null;
          sort_order?: number;
          updated_at?: string;
        };
      };
      wall_segments: {
        Row: {
          id: string;
          gym_id: string;
          sector_id: string;
          name: string;
          start_point: Json;
          end_point: Json;
          angle_label: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          gym_id: string;
          sector_id: string;
          name?: string;
          start_point?: Json;
          end_point?: Json;
          angle_label?: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          gym_id?: string;
          sector_id?: string;
          name?: string;
          start_point?: Json;
          end_point?: Json;
          angle_label?: string;
          sort_order?: number;
        };
      };
      boulders: {
        Row: {
          id: string;
          gym_id: string;
          sector_id: string;
          segment_id: string | null;
          name: string;
          grade: number;
          hold_color: string;
          author: string;
          position: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          gym_id: string;
          sector_id: string;
          segment_id?: string | null;
          name?: string;
          grade: number;
          hold_color?: string;
          author?: string;
          position?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          gym_id?: string;
          sector_id?: string;
          segment_id?: string | null;
          name?: string;
          grade?: number;
          hold_color?: string;
          author?: string;
          position?: Json;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          gym_id: string | null;
          role: "admin" | "viewer";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          gym_id?: string | null;
          role?: "admin" | "viewer";
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          gym_id?: string | null;
          role?: "admin" | "viewer";
        };
      };
    };
    Functions: {
      is_admin: {
        Args: { p_gym_id: string };
        Returns: boolean;
      };
      get_user_role: {
        Args: { p_gym_id: string };
        Returns: string;
      };
    };
  };
}
