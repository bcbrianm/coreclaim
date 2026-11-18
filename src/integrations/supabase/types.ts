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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      core_credit_allocations: {
        Row: {
          allocated_amount: number
          core_id: string
          created_at: string
          id: string
          shop_id: string
          statement_line_id: string
        }
        Insert: {
          allocated_amount: number
          core_id: string
          created_at?: string
          id?: string
          shop_id: string
          statement_line_id: string
        }
        Update: {
          allocated_amount?: number
          core_id?: string
          created_at?: string
          id?: string
          shop_id?: string
          statement_line_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "core_credit_allocations_core_id_fkey"
            columns: ["core_id"]
            isOneToOne: false
            referencedRelation: "cores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_credit_allocations_core_id_fkey"
            columns: ["core_id"]
            isOneToOne: false
            referencedRelation: "mechanic_cores_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_credit_allocations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_credit_allocations_statement_line_id_fkey"
            columns: ["statement_line_id"]
            isOneToOne: false
            referencedRelation: "statement_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      core_events: {
        Row: {
          actor_member_id: string | null
          actor_type: string
          core_id: string
          created_at: string
          event_type: string
          id: string
          metadata_json: Json
          new_status: string | null
          previous_status: string | null
          shop_id: string
        }
        Insert: {
          actor_member_id?: string | null
          actor_type?: string
          core_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata_json?: Json
          new_status?: string | null
          previous_status?: string | null
          shop_id: string
        }
        Update: {
          actor_member_id?: string | null
          actor_type?: string
          core_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata_json?: Json
          new_status?: string | null
          previous_status?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "core_events_actor_member_id_fkey"
            columns: ["actor_member_id"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_events_core_id_fkey"
            columns: ["core_id"]
            isOneToOne: false
            referencedRelation: "cores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_events_core_id_fkey"
            columns: ["core_id"]
            isOneToOne: false
            referencedRelation: "mechanic_cores_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_events_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      cores: {
        Row: {
          condition_photo_url: string | null
          created_at: string
          created_by_member_id: string | null
          credited_amount: number
          current_status: string
          customer_name: string | null
          expected_core_amount: number
          id: string
          invoice_date: string | null
          invoice_image_url: string | null
          is_backroom_audit: boolean
          is_ro_completed: boolean
          original_box_intact: boolean
          parent_core_id: string | null
          part_cost: number
          part_description: string | null
          part_number: string
          return_deadline: string | null
          return_type: string
          ro_number: string | null
          shop_id: string
          short_code: string
          supplier_id: string
          supplier_invoice_number: string
          unit_sequence: number
          updated_at: string
          variance_amount: number | null
          vehicle_description: string | null
          vin: string | null
          warranty_covers_labor: boolean
          warranty_months: number
        }
        Insert: {
          condition_photo_url?: string | null
          created_at?: string
          created_by_member_id?: string | null
          credited_amount?: number
          current_status?: string
          customer_name?: string | null
          expected_core_amount?: number
          id?: string
          invoice_date?: string | null
          invoice_image_url?: string | null
          is_backroom_audit?: boolean
          is_ro_completed?: boolean
          original_box_intact?: boolean
          parent_core_id?: string | null
          part_cost?: number
          part_description?: string | null
          part_number?: string
          return_deadline?: string | null
          return_type?: string
          ro_number?: string | null
          shop_id: string
          short_code?: string
          supplier_id: string
          supplier_invoice_number?: string
          unit_sequence?: number
          updated_at?: string
          variance_amount?: number | null
          vehicle_description?: string | null
          vin?: string | null
          warranty_covers_labor?: boolean
          warranty_months?: number
        }
        Update: {
          condition_photo_url?: string | null
          created_at?: string
          created_by_member_id?: string | null
          credited_amount?: number
          current_status?: string
          customer_name?: string | null
          expected_core_amount?: number
          id?: string
          invoice_date?: string | null
          invoice_image_url?: string | null
          is_backroom_audit?: boolean
          is_ro_completed?: boolean
          original_box_intact?: boolean
          parent_core_id?: string | null
          part_cost?: number
          part_description?: string | null
          part_number?: string
          return_deadline?: string | null
          return_type?: string
          ro_number?: string | null
          shop_id?: string
          short_code?: string
          supplier_id?: string
          supplier_invoice_number?: string
          unit_sequence?: number
          updated_at?: string
          variance_amount?: number | null
          vehicle_description?: string | null
          vin?: string | null
          warranty_covers_labor?: boolean
          warranty_months?: number
        }
        Relationships: [
          {
            foreignKeyName: "cores_created_by_member_id_fkey"
            columns: ["created_by_member_id"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cores_parent_core_id_fkey"
            columns: ["parent_core_id"]
            isOneToOne: false
            referencedRelation: "cores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cores_parent_core_id_fkey"
            columns: ["parent_core_id"]
            isOneToOne: false
            referencedRelation: "mechanic_cores_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cores_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cores_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          channel: string | null
          dedupe_key: string | null
          id: string
          recipient: string | null
          sent_at: string
          shop_id: string
        }
        Insert: {
          channel?: string | null
          dedupe_key?: string | null
          id?: string
          recipient?: string | null
          sent_at?: string
          shop_id: string
        }
        Update: {
          channel?: string | null
          dedupe_key?: string | null
          id?: string
          recipient?: string | null
          sent_at?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_manifest_items: {
        Row: {
          core_id: string
          id: string
          manifest_id: string
        }
        Insert: {
          core_id: string
          id?: string
          manifest_id: string
        }
        Update: {
          core_id?: string
          id?: string
          manifest_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pickup_manifest_items_core_id_fkey"
            columns: ["core_id"]
            isOneToOne: false
            referencedRelation: "cores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickup_manifest_items_core_id_fkey"
            columns: ["core_id"]
            isOneToOne: false
            referencedRelation: "mechanic_cores_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickup_manifest_items_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "pickup_manifests"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_manifests: {
        Row: {
          created_at: string
          created_by_member_id: string | null
          driver_name: string | null
          driver_truck_number: string | null
          id: string
          loadout_photo_url: string | null
          manifest_pdf_url: string | null
          shop_id: string
          signature_url: string | null
          supplier_id: string
        }
        Insert: {
          created_at?: string
          created_by_member_id?: string | null
          driver_name?: string | null
          driver_truck_number?: string | null
          id?: string
          loadout_photo_url?: string | null
          manifest_pdf_url?: string | null
          shop_id: string
          signature_url?: string | null
          supplier_id: string
        }
        Update: {
          created_at?: string
          created_by_member_id?: string | null
          driver_name?: string | null
          driver_truck_number?: string | null
          id?: string
          loadout_photo_url?: string | null
          manifest_pdf_url?: string | null
          shop_id?: string
          signature_url?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pickup_manifests_created_by_member_id_fkey"
            columns: ["created_by_member_id"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickup_manifests_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickup_manifests_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_webhook_events: {
        Row: {
          event_key: string
          processed_at: string
        }
        Insert: {
          event_key: string
          processed_at?: string
        }
        Update: {
          event_key?: string
          processed_at?: string
        }
        Relationships: []
      }
      shop_integrations: {
        Row: {
          alert_preference: string
          api_key_encrypted: string | null
          created_at: string
          id: string
          manager_emails: string[]
          manager_phones: string[]
          outbound_webhook_url: string | null
          owner_emails: string[]
          owner_phones: string[]
          shop_id: string
          sms_provider: string
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          alert_preference?: string
          api_key_encrypted?: string | null
          created_at?: string
          id?: string
          manager_emails?: string[]
          manager_phones?: string[]
          outbound_webhook_url?: string | null
          owner_emails?: string[]
          owner_phones?: string[]
          shop_id: string
          sms_provider?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          alert_preference?: string
          api_key_encrypted?: string | null
          created_at?: string
          id?: string
          manager_emails?: string[]
          manager_phones?: string[]
          outbound_webhook_url?: string | null
          owner_emails?: string[]
          owner_phones?: string[]
          shop_id?: string
          sms_provider?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_integrations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_invites: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          shop_id: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          shop_id: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          shop_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_invites_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_member_pins: {
        Row: {
          failed_attempts: number
          locked_until: string | null
          member_id: string
          pin_hash: string
        }
        Insert: {
          failed_attempts?: number
          locked_until?: string | null
          member_id: string
          pin_hash: string
        }
        Update: {
          failed_attempts?: number
          locked_until?: string | null
          member_id?: string
          pin_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_member_pins_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_members: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          shop_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          shop_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          shop_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_members_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          address: string | null
          created_at: string
          feature_flags: Json
          id: string
          inbound_email_alias: string
          labor_rate_hourly: number
          name: string
          phone: string | null
          stripe_customer_id: string | null
          subscription_status: string
          subscription_tier: string
          timezone: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          feature_flags?: Json
          id?: string
          inbound_email_alias?: string
          labor_rate_hourly?: number
          name: string
          phone?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string
          subscription_tier?: string
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          feature_flags?: Json
          id?: string
          inbound_email_alias?: string
          labor_rate_hourly?: number
          name?: string
          phone?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string
          subscription_tier?: string
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      statement_lines: {
        Row: {
          credit_amount: number
          id: string
          invoice_ref: string | null
          matched_status: string
          part_number: string | null
          shop_id: string
          statement_id: string
        }
        Insert: {
          credit_amount?: number
          id?: string
          invoice_ref?: string | null
          matched_status?: string
          part_number?: string | null
          shop_id: string
          statement_id: string
        }
        Update: {
          credit_amount?: number
          id?: string
          invoice_ref?: string | null
          matched_status?: string
          part_number?: string | null
          shop_id?: string
          statement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "statement_lines_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_lines_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "vendor_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          account_number: string | null
          ar_dispute_email: string | null
          created_at: string
          default_return_window_days: number
          grace_period_days: number
          id: string
          is_active: boolean
          name: string
          shop_id: string
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          ar_dispute_email?: string | null
          created_at?: string
          default_return_window_days?: number
          grace_period_days?: number
          id?: string
          is_active?: boolean
          name: string
          shop_id: string
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          ar_dispute_email?: string | null
          created_at?: string
          default_return_window_days?: number
          grace_period_days?: number
          id?: string
          is_active?: boolean
          name?: string
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_statements: {
        Row: {
          created_at: string
          id: string
          shop_id: string
          statement_date: string | null
          statement_pdf_url: string | null
          status: string
          supplier_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          shop_id: string
          statement_date?: string | null
          statement_pdf_url?: string | null
          status?: string
          supplier_id: string
        }
        Update: {
          created_at?: string
          id?: string
          shop_id?: string
          statement_date?: string | null
          statement_pdf_url?: string | null
          status?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_statements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_statements_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_claims: {
        Row: {
          claim_pdf_url: string | null
          core_id: string
          created_at: string
          created_by_member_id: string | null
          failure_date: string | null
          failure_reason: string | null
          id: string
          labor_hours_claimed: number
          labor_rate_snapshot: number
          shop_id: string
          status: string
          total_claim_amount: number
        }
        Insert: {
          claim_pdf_url?: string | null
          core_id: string
          created_at?: string
          created_by_member_id?: string | null
          failure_date?: string | null
          failure_reason?: string | null
          id?: string
          labor_hours_claimed?: number
          labor_rate_snapshot?: number
          shop_id: string
          status?: string
          total_claim_amount?: number
        }
        Update: {
          claim_pdf_url?: string | null
          core_id?: string
          created_at?: string
          created_by_member_id?: string | null
          failure_date?: string | null
          failure_reason?: string | null
          id?: string
          labor_hours_claimed?: number
          labor_rate_snapshot?: number
          shop_id?: string
          status?: string
          total_claim_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "warranty_claims_core_id_fkey"
            columns: ["core_id"]
            isOneToOne: false
            referencedRelation: "cores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_claims_core_id_fkey"
            columns: ["core_id"]
            isOneToOne: false
            referencedRelation: "mechanic_cores_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_claims_created_by_member_id_fkey"
            columns: ["created_by_member_id"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_claims_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      mechanic_cores_view: {
        Row: {
          condition_photo_url: string | null
          created_at: string | null
          current_status: string | null
          customer_name: string | null
          id: string | null
          invoice_date: string | null
          is_backroom_audit: boolean | null
          is_ro_completed: boolean | null
          original_box_intact: boolean | null
          part_description: string | null
          part_number: string | null
          return_deadline: string | null
          return_type: string | null
          ro_number: string | null
          shop_id: string | null
          short_code: string | null
          supplier_id: string | null
          supplier_invoice_number: string | null
          supplier_name: string | null
          unit_sequence: number | null
          vehicle_description: string | null
          vin: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cores_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cores_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_pending_invites: { Args: never; Returns: string[] }
      complete_driver_pickup: {
        Args: {
          p_actor_member_id?: string
          p_core_ids: string[]
          p_driver_name?: string
          p_driver_truck_number?: string
          p_loadout_photo_url?: string
          p_shop_id: string
          p_signature_url?: string
          p_supplier_id: string
        }
        Returns: string
      }
      create_shop_workspace: {
        Args: {
          owner_full_name: string
          owner_pin: string
          shop_name: string
          shop_phone: string
          shop_timezone: string
        }
        Returns: string
      }
      has_shop_role: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["app_role"][]
          target_shop_id: string
        }
        Returns: boolean
      }
      is_shop_member: { Args: { target_shop_id: string }; Returns: boolean }
      mechanic_update_core_status: {
        Args: {
          p_actor_member_id?: string
          p_condition_photo_url?: string
          p_core_id: string
          p_new_status: string
          p_original_box_intact?: boolean
        }
        Returns: Json
      }
      member_pin_status: {
        Args: { p_shop_id: string }
        Returns: {
          has_pin: boolean
          is_locked: boolean
          member_id: string
        }[]
      }
      set_shop_member_pin: {
        Args: { new_pin: string; target_member_id: string }
        Returns: undefined
      }
      unlock_shop_member_pin: {
        Args: { target_member_id: string }
        Returns: undefined
      }
      verify_shop_pin: {
        Args: { raw_pin: string; target_member_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "mechanic" | "shop_user" | "super_user" | "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["mechanic", "shop_user", "super_user", "admin"],
    },
  },
} as const
