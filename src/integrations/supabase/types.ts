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
  public: {
    Tables: {
      attendance_records: {
        Row: {
          candidate_id: string
          class_id: string
          created_at: string
          id: string
          lesson_date: string
          mark: Database["public"]["Enums"]["attendance_mark"]
          marked_by: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          candidate_id: string
          class_id: string
          created_at?: string
          id?: string
          lesson_date?: string
          mark: Database["public"]["Enums"]["attendance_mark"]
          marked_by?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          class_id?: string
          created_at?: string
          id?: string
          lesson_date?: string
          mark?: Database["public"]["Enums"]["attendance_mark"]
          marked_by?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      beqa_diagnostic_sessions: {
        Row: {
          accuracy_score: number | null
          baseline_hr: number | null
          created_at: string
          end_time: string | null
          final_beqa_score: number | null
          id: string
          metadata: Json
          reaction_time_avg: number | null
          start_time: string
          stress_hr: number | null
          student_id: string
          updated_at: string
        }
        Insert: {
          accuracy_score?: number | null
          baseline_hr?: number | null
          created_at?: string
          end_time?: string | null
          final_beqa_score?: number | null
          id?: string
          metadata?: Json
          reaction_time_avg?: number | null
          start_time?: string
          stress_hr?: number | null
          student_id: string
          updated_at?: string
        }
        Update: {
          accuracy_score?: number | null
          baseline_hr?: number | null
          created_at?: string
          end_time?: string | null
          final_beqa_score?: number | null
          id?: string
          metadata?: Json
          reaction_time_avg?: number | null
          start_time?: string
          stress_hr?: number | null
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      candidate_documents: {
        Row: {
          candidate_id: string
          created_at: string
          file_path: string
          id: string
          label: string
          mime_type: string | null
          size_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          file_path: string
          id?: string
          label: string
          mime_type?: string | null
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          file_path?: string
          id?: string
          label?: string
          mime_type?: string | null
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_documents_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          assigned_teacher_id: string | null
          city_id: string | null
          class_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          language: string | null
          notes: string | null
          phone: string | null
          status: Database["public"]["Enums"]["candidate_status"]
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          assigned_teacher_id?: string | null
          city_id?: string | null
          class_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          language?: string | null
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["candidate_status"]
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          assigned_teacher_id?: string | null
          city_id?: string | null
          class_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          language?: string | null
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["candidate_status"]
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          created_at: string
          id: string
          name: string
          name_he: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          name_he?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          name_he?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          capacity: number
          city_id: string | null
          created_at: string
          id: string
          name: string
          schedule: string | null
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          capacity?: number
          city_id?: string | null
          created_at?: string
          id?: string
          name: string
          schedule?: string | null
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          capacity?: number
          city_id?: string | null
          created_at?: string
          id?: string
          name?: string
          schedule?: string | null
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_options: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          option_text: string
          order_index: number
          question_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct?: boolean
          option_text: string
          order_index?: number
          question_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          option_text?: string
          order_index?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "exam_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_questions: {
        Row: {
          created_at: string
          exam_id: string
          id: string
          image_url: string | null
          order_index: number
          question_text: string
        }
        Insert: {
          created_at?: string
          exam_id: string
          id?: string
          image_url?: string | null
          order_index?: number
          question_text: string
        }
        Update: {
          created_at?: string
          exam_id?: string
          id?: string
          image_url?: string | null
          order_index?: number
          question_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_results: {
        Row: {
          category: string
          created_at: string
          exam_id: string | null
          exam_title: string | null
          failed_questions: Json
          id: string
          passed: boolean
          score: number
          taken_at: string
          total_questions: number
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          exam_id?: string | null
          exam_title?: string | null
          failed_questions?: Json
          id?: string
          passed?: boolean
          score?: number
          taken_at?: string
          total_questions?: number
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          exam_id?: string | null
          exam_title?: string | null
          failed_questions?: Json
          id?: string
          passed?: boolean
          score?: number
          taken_at?: string
          total_questions?: number
          user_id?: string
        }
        Relationships: []
      }
      exams: {
        Row: {
          class_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      makeup_assignments: {
        Row: {
          candidate_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          source_attendance_id: string | null
          source_class_id: string
          source_date: string
          status: Database["public"]["Enums"]["makeup_status"]
          target_class_id: string | null
          target_date: string | null
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          source_attendance_id?: string | null
          source_class_id: string
          source_date: string
          status?: Database["public"]["Enums"]["makeup_status"]
          target_class_id?: string | null
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          source_attendance_id?: string | null
          source_class_id?: string
          source_date?: string
          status?: Database["public"]["Enums"]["makeup_status"]
          target_class_id?: string | null
          target_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      materials: {
        Row: {
          category: Database["public"]["Enums"]["material_category"]
          class_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          external_link: string | null
          file_url: string | null
          id: string
          title: string
          type: Database["public"]["Enums"]["material_type"]
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["material_category"]
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          external_link?: string | null
          file_url?: string | null
          id?: string
          title: string
          type?: Database["public"]["Enums"]["material_type"]
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["material_category"]
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          external_link?: string | null
          file_url?: string | null
          id?: string
          title?: string
          type?: Database["public"]["Enums"]["material_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          candidate_id: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          created_by: string | null
          error: string | null
          event_id: string | null
          id: string
          language: string
          message: string
          provider_sid: string | null
          scheduled_at: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          to_phone: string
          updated_at: string
        }
        Insert: {
          candidate_id?: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          created_by?: string | null
          error?: string | null
          event_id?: string | null
          id?: string
          language?: string
          message: string
          provider_sid?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          to_phone: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          created_by?: string | null
          error?: string | null
          event_id?: string | null
          id?: string
          language?: string
          message?: string
          provider_sid?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          to_phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "schedule_events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          branch: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          language: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          branch?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          language?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          branch?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          language?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      raw_biometric_log: {
        Row: {
          bpm: number | null
          event_type: string
          hrv: number | null
          id: string
          payload: Json
          recorded_at: string
          session_id: string
          student_id: string
        }
        Insert: {
          bpm?: number | null
          event_type: string
          hrv?: number | null
          id?: string
          payload?: Json
          recorded_at?: string
          session_id: string
          student_id: string
        }
        Update: {
          bpm?: number | null
          event_type?: string
          hrv?: number | null
          id?: string
          payload?: Json
          recorded_at?: string
          session_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_biometric_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "beqa_diagnostic_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_events: {
        Row: {
          candidate_id: string | null
          class_id: string | null
          created_at: string
          created_by: string | null
          end_time: string | null
          event_date: string
          exam_id: string | null
          id: string
          location: string | null
          notes: string | null
          start_time: string | null
          title: string
          type: Database["public"]["Enums"]["schedule_event_type"]
          updated_at: string
        }
        Insert: {
          candidate_id?: string | null
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          event_date: string
          exam_id?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          start_time?: string | null
          title: string
          type?: Database["public"]["Enums"]["schedule_event_type"]
          updated_at?: string
        }
        Update: {
          candidate_id?: string | null
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          event_date?: string
          exam_id?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          start_time?: string | null
          title?: string
          type?: Database["public"]["Enums"]["schedule_event_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_events_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_events_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_assignments: {
        Row: {
          city_id: string | null
          class_id: string | null
          created_at: string
          id: string
          teacher_id: string
        }
        Insert: {
          city_id?: string | null
          class_id?: string | null
          created_at?: string
          id?: string
          teacher_id: string
        }
        Update: {
          city_id?: string | null
          class_id?: string | null
          created_at?: string
          id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      get_primary_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
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
      app_role: "owner" | "staff" | "teacher" | "student"
      attendance_mark: "present" | "late" | "missing" | "makeup_completed"
      candidate_status:
        | "new_lead"
        | "contacted"
        | "missing_docs"
        | "waiting_opening"
        | "assigned"
        | "active"
        | "completed"
        | "inactive"
        | "failed"
      makeup_status: "pending" | "scheduled" | "completed" | "cancelled"
      material_category: "study" | "enrichment"
      material_type: "pdf" | "image" | "link" | "video"
      notification_channel: "sms" | "whatsapp"
      notification_status: "pending" | "sent" | "failed" | "cancelled"
      schedule_event_type: "lesson" | "exam" | "makeup"
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
      app_role: ["owner", "staff", "teacher", "student"],
      attendance_mark: ["present", "late", "missing", "makeup_completed"],
      candidate_status: [
        "new_lead",
        "contacted",
        "missing_docs",
        "waiting_opening",
        "assigned",
        "active",
        "completed",
        "inactive",
        "failed",
      ],
      makeup_status: ["pending", "scheduled", "completed", "cancelled"],
      material_category: ["study", "enrichment"],
      material_type: ["pdf", "image", "link", "video"],
      notification_channel: ["sms", "whatsapp"],
      notification_status: ["pending", "sent", "failed", "cancelled"],
      schedule_event_type: ["lesson", "exam", "makeup"],
    },
  },
} as const
