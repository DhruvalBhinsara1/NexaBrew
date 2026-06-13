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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      categories: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          used_count?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      floors: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      kitchen_ticket_items: {
        Row: {
          id: string
          is_completed: boolean
          order_item_id: string
          product_name: string
          quantity: number
          ticket_id: string
        }
        Insert: {
          id?: string
          is_completed?: boolean
          order_item_id: string
          product_name: string
          quantity: number
          ticket_id: string
        }
        Update: {
          id?: string
          is_completed?: boolean
          order_item_id?: string
          product_name?: string
          quantity?: number
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_ticket_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_ticket_items_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "kitchen_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_tickets: {
        Row: {
          completed_at: string | null
          id: string
          order_id: string
          sent_at: string
          status: string
          ticket_number: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          order_id: string
          sent_at?: string
          status?: string
          ticket_number: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          order_id?: string
          sent_at?: string
          status?: string
          ticket_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          discount_amount: number
          id: string
          line_total: number
          order_id: string
          product_id: string
          product_name: string
          promotion_id: string | null
          quantity: number
          tax_rate: number
          unit_price: number
        }
        Insert: {
          discount_amount?: number
          id?: string
          line_total: number
          order_id: string
          product_id: string
          product_name: string
          promotion_id?: string | null
          quantity: number
          tax_rate?: number
          unit_price: number
        }
        Update: {
          discount_amount?: number
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string
          product_name?: string
          promotion_id?: string | null
          quantity?: number
          tax_rate?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          coupon_id: string | null
          created_at: string
          customer_id: string | null
          discount_amount: number
          employee_id: string
          id: string
          notes: string | null
          order_number: string
          promotion_id: string | null
          session_id: string
          status: string
          subtotal: number
          table_id: string | null
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          coupon_id?: string | null
          created_at?: string
          customer_id?: string | null
          discount_amount?: number
          employee_id: string
          id?: string
          notes?: string | null
          order_number?: string
          promotion_id?: string | null
          session_id: string
          status?: string
          subtotal?: number
          table_id?: string | null
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          coupon_id?: string | null
          created_at?: string
          customer_id?: string | null
          discount_amount?: number
          employee_id?: string
          id?: string
          notes?: string | null
          order_number?: string
          promotion_id?: string | null
          session_id?: string
          status?: string
          subtotal?: number
          table_id?: string | null
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          id: string
          is_enabled: boolean
          type: string
          updated_at: string
          upi_id: string | null
        }
        Insert: {
          id?: string
          is_enabled?: boolean
          type: string
          updated_at?: string
          upi_id?: string | null
        }
        Update: {
          id?: string
          is_enabled?: boolean
          type?: string
          updated_at?: string
          upi_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_paid: number
          amount_tendered: number | null
          change_due: number | null
          created_at: string
          id: string
          order_id: string
          paid_at: string | null
          payment_method_type: string
          status: string
          transaction_reference: string | null
        }
        Insert: {
          amount_paid: number
          amount_tendered?: number | null
          change_due?: number | null
          created_at?: string
          id?: string
          order_id: string
          paid_at?: string | null
          payment_method_type: string
          status?: string
          transaction_reference?: string | null
        }
        Update: {
          amount_paid?: number
          amount_tendered?: number | null
          change_due?: number | null
          created_at?: string
          id?: string
          order_id?: string
          paid_at?: string | null
          payment_method_type?: string
          status?: string
          transaction_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_kitchen_display: boolean
          name: string
          price: number
          tax_rate: number
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_kitchen_display?: boolean
          name: string
          price: number
          tax_rate?: number
          unit_of_measure: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_kitchen_display?: boolean
          name?: string
          price?: number
          tax_rate?: number
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          applies_to: string
          created_at: string
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          min_order_amount: number | null
          min_quantity: number | null
          name: string
          product_id: string | null
        }
        Insert: {
          applies_to: string
          created_at?: string
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean
          min_order_amount?: number | null
          min_quantity?: number | null
          name: string
          product_id?: string | null
        }
        Update: {
          applies_to?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          min_order_amount?: number | null
          min_quantity?: number | null
          name?: string
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promotions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          closed_at: string | null
          closing_balance: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_balance: number
          status: string
        }
        Insert: {
          closed_at?: string | null
          closing_balance?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_balance?: number
          status?: string
        }
        Update: {
          closed_at?: string | null
          closing_balance?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_balance?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          created_at: string
          floor_id: string
          id: string
          is_active: boolean
          seats: number
          status: string
          table_number: number
        }
        Insert: {
          created_at?: string
          floor_id: string
          id?: string
          is_active?: boolean
          seats: number
          status?: string
          table_number: number
        }
        Update: {
          created_at?: string
          floor_id?: string
          id?: string
          is_active?: boolean
          seats?: number
          status?: string
          table_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "tables_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          is_archived: boolean
          name: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          is_archived?: boolean
          name: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_archived?: boolean
          name?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_order_number: { Args: never; Returns: string }
      get_user_role: { Args: never; Returns: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
