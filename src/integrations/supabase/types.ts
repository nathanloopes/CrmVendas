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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      access_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_prompts: {
        Row: {
          created_at: string | null
          id: string
          prompt_text: string
          prompt_type: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          prompt_text: string
          prompt_type: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          prompt_text?: string
          prompt_type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_score_learnings: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
        }
        Relationships: []
      }
      app_version: {
        Row: {
          id: string
          release_notes: string | null
          updated_at: string
          version: string
        }
        Insert: {
          id?: string
          release_notes?: string | null
          updated_at?: string
          version?: string
        }
        Update: {
          id?: string
          release_notes?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      approved_emails: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          email: string
          equipe: string | null
          expires_at: string
          funcao: string | null
          id: string
          invited_user_name: string | null
          nivel: string | null
          role: string
          status: string
          updated_at: string | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          email: string
          equipe?: string | null
          expires_at?: string
          funcao?: string | null
          id?: string
          invited_user_name?: string | null
          nivel?: string | null
          role?: string
          status?: string
          updated_at?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          email?: string
          equipe?: string | null
          expires_at?: string
          funcao?: string | null
          id?: string
          invited_user_name?: string | null
          nivel?: string | null
          role?: string
          status?: string
          updated_at?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approved_emails_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "approved_emails_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      available_cities: {
        Row: {
          city: string
          country: string
          created_at: string
          created_by: string | null
          gdp: number | null
          id: string
          is_reposition: boolean
          notes: string | null
          occupied_at: string | null
          occupied_by_lead_id: string | null
          population: number | null
          released_at: string | null
          released_reason: string | null
          state: string
          state_full_name: string | null
          status: string
          store_model: string | null
          study_file_name: string | null
          study_file_name_es: string | null
          study_file_path: string | null
          study_file_path_es: string | null
          study_uploaded_at: string | null
          study_uploaded_at_es: string | null
          study_uploaded_by: string | null
          study_uploaded_by_es: string | null
          updated_at: string
        }
        Insert: {
          city: string
          country?: string
          created_at?: string
          created_by?: string | null
          gdp?: number | null
          id?: string
          is_reposition?: boolean
          notes?: string | null
          occupied_at?: string | null
          occupied_by_lead_id?: string | null
          population?: number | null
          released_at?: string | null
          released_reason?: string | null
          state: string
          state_full_name?: string | null
          status?: string
          store_model?: string | null
          study_file_name?: string | null
          study_file_name_es?: string | null
          study_file_path?: string | null
          study_file_path_es?: string | null
          study_uploaded_at?: string | null
          study_uploaded_at_es?: string | null
          study_uploaded_by?: string | null
          study_uploaded_by_es?: string | null
          updated_at?: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          created_by?: string | null
          gdp?: number | null
          id?: string
          is_reposition?: boolean
          notes?: string | null
          occupied_at?: string | null
          occupied_by_lead_id?: string | null
          population?: number | null
          released_at?: string | null
          released_reason?: string | null
          state?: string
          state_full_name?: string | null
          status?: string
          store_model?: string | null
          study_file_name?: string | null
          study_file_name_es?: string | null
          study_file_path?: string | null
          study_file_path_es?: string | null
          study_uploaded_at?: string | null
          study_uploaded_at_es?: string | null
          study_uploaded_by?: string | null
          study_uploaded_by_es?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "available_cities_occupied_by_lead_id_fkey"
            columns: ["occupied_by_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "available_cities_occupied_by_lead_id_fkey"
            columns: ["occupied_by_lead_id"]
            isOneToOne: false
            referencedRelation: "leads_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          attendees: string[] | null
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_datetime: string
          event_type: string
          google_calendar_event_id: string | null
          google_calendar_sync_status: string | null
          google_meet_link: string | null
          id: string
          last_sync_error: string | null
          lead_id: string | null
          location: string | null
          reminder_d0_sent_at: string | null
          reminder_d1_sent_at: string | null
          responsible_user_id: string
          start_datetime: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          attendees?: string[] | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_datetime: string
          event_type?: string
          google_calendar_event_id?: string | null
          google_calendar_sync_status?: string | null
          google_meet_link?: string | null
          id?: string
          last_sync_error?: string | null
          lead_id?: string | null
          location?: string | null
          reminder_d0_sent_at?: string | null
          reminder_d1_sent_at?: string | null
          responsible_user_id: string
          start_datetime: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          attendees?: string[] | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_datetime?: string
          event_type?: string
          google_calendar_event_id?: string | null
          google_calendar_sync_status?: string | null
          google_meet_link?: string | null
          id?: string
          last_sync_error?: string | null
          lead_id?: string | null
          location?: string | null
          reminder_d0_sent_at?: string | null
          reminder_d1_sent_at?: string | null
          responsible_user_id?: string
          start_datetime?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "calendar_events_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_executions: {
        Row: {
          campaign_id: string
          completed_at: string | null
          created_at: string | null
          executed_at: string
          failure_count: number
          id: string
          recipient_count: number
          status: string
          success_count: number
          updated_at: string | null
        }
        Insert: {
          campaign_id: string
          completed_at?: string | null
          created_at?: string | null
          executed_at?: string
          failure_count?: number
          id?: string
          recipient_count?: number
          status?: string
          success_count?: number
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string
          completed_at?: string | null
          created_at?: string | null
          executed_at?: string
          failure_count?: number
          id?: string
          recipient_count?: number
          status?: string
          success_count?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_executions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_logs: {
        Row: {
          campaign_id: string
          created_at: string | null
          execution_id: string | null
          id: string
          log_type: string
          message: string
          metadata: Json | null
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          execution_id?: string | null
          id?: string
          log_type: string
          message: string
          metadata?: Json | null
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          execution_id?: string | null
          id?: string
          log_type?: string
          message?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_logs_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "campaign_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          campaign_id: string
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          execution_id: string | null
          id: string
          lead_id: string | null
          name: string
          phone: string
          read_at: string | null
          sent_at: string | null
          stage: string
          status: string
          updated_at: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          execution_id?: string | null
          id?: string
          lead_id?: string | null
          name?: string
          phone?: string
          read_at?: string | null
          sent_at?: string | null
          stage?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          execution_id?: string | null
          id?: string
          lead_id?: string | null
          name?: string
          phone?: string
          read_at?: string | null
          sent_at?: string | null
          stage?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "campaign_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string | null
          description: string | null
          filters: Json | null
          id: string
          last_execution_at: string | null
          message: string
          name: string
          next_execution_at: string | null
          recipient_count: number | null
          schedule: Json | null
          stats: Json | null
          status: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          filters?: Json | null
          id?: string
          last_execution_at?: string | null
          message: string
          name: string
          next_execution_at?: string | null
          recipient_count?: number | null
          schedule?: Json | null
          stats?: Json | null
          status?: string
          type?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          filters?: Json | null
          id?: string
          last_execution_at?: string | null
          message?: string
          name?: string
          next_execution_at?: string | null
          recipient_count?: number | null
          schedule?: Json | null
          stats?: Json | null
          status?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_broadcast_reads: {
        Row: {
          acknowledged_at: string | null
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_broadcast_reads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          last_message_at: string
          subject: string | null
          type: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          last_message_at?: string
          subject?: string | null
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          last_message_at?: string
          subject?: string | null
          type?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          attached_items: Json
          attachments: Json
          content: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          mentions: string[]
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          attached_items?: Json
          attachments?: Json
          content?: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          mentions?: string[]
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          attached_items?: Json
          attachments?: Json
          content?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          mentions?: string[]
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          archived: boolean
          conversation_id: string
          created_at: string
          id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          conversation_id: string
          created_at?: string
          id?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          conversation_id?: string
          created_at?: string
          id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_briefing_views: {
        Row: {
          id: string
          user_id: string
          viewed_at: string | null
          viewed_date: string
        }
        Insert: {
          id?: string
          user_id: string
          viewed_at?: string | null
          viewed_date?: string
        }
        Update: {
          id?: string
          user_id?: string
          viewed_at?: string | null
          viewed_date?: string
        }
        Relationships: []
      }
      daily_routine_completions: {
        Row: {
          checklist_state: Json
          completed_at: string
          completion_date: string
          id: string
          notes: string | null
          routine_id: string
          user_id: string
        }
        Insert: {
          checklist_state?: Json
          completed_at?: string
          completion_date: string
          id?: string
          notes?: string | null
          routine_id: string
          user_id: string
        }
        Update: {
          checklist_state?: Json
          completed_at?: string
          completion_date?: string
          id?: string
          notes?: string | null
          routine_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_routine_completions_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "daily_routines"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_routines: {
        Row: {
          active: boolean
          assigned_user_ids: string[]
          checklist: Json
          created_at: string
          created_by: string | null
          days_of_week: number[]
          description: string | null
          frequency: string
          id: string
          instructions: string | null
          popup_enabled: boolean
          scheduled_time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          assigned_user_ids?: string[]
          checklist?: Json
          created_at?: string
          created_by?: string | null
          days_of_week?: number[]
          description?: string | null
          frequency?: string
          id?: string
          instructions?: string | null
          popup_enabled?: boolean
          scheduled_time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          assigned_user_ids?: string[]
          checklist?: Json
          created_at?: string
          created_by?: string | null
          days_of_week?: number[]
          description?: string | null
          frequency?: string
          id?: string
          instructions?: string | null
          popup_enabled?: boolean
          scheduled_time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ddd_reference: {
        Row: {
          created_at: string
          ddd: string
          description: string | null
          id: string
          main_city: string
          region: string
          state: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ddd: string
          description?: string | null
          id?: string
          main_city: string
          region: string
          state: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ddd?: string
          description?: string | null
          id?: string
          main_city?: string
          region?: string
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      deleted_leads_log: {
        Row: {
          deleted_at: string | null
          deleted_by: string | null
          id: string
          lead_id: string
          lead_name: string | null
          reason: string
        }
        Insert: {
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          lead_id: string
          lead_name?: string | null
          reason: string
        }
        Update: {
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          lead_id?: string
          lead_name?: string | null
          reason?: string
        }
        Relationships: []
      }
      doc_cobranca_responses: {
        Row: {
          created_at: string | null
          doc_request_id: string
          id: string
          notification_id: string
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          doc_request_id: string
          id?: string
          notification_id: string
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          doc_request_id?: string
          id?: string
          notification_id?: string
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doc_cobranca_responses_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_kanban_settings: {
        Row: {
          columns: Json
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          columns?: Json
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          columns?: Json
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      doc_request_checklist: {
        Row: {
          checked: boolean
          checked_at: string | null
          checked_by: string | null
          created_at: string
          doc_request_id: string
          id: string
          label: string
        }
        Insert: {
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          doc_request_id: string
          id?: string
          label: string
        }
        Update: {
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          doc_request_id?: string
          id?: string
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "doc_request_checklist_doc_request_id_fkey"
            columns: ["doc_request_id"]
            isOneToOne: false
            referencedRelation: "doc_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_request_comments: {
        Row: {
          content: string
          created_at: string
          created_by: string
          doc_request_id: string
          id: string
          is_pending: boolean
          mentioned_user_ids: string[] | null
          pending_resolved_at: string | null
          pending_resolved_by: string | null
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          doc_request_id: string
          id?: string
          is_pending?: boolean
          mentioned_user_ids?: string[] | null
          pending_resolved_at?: string | null
          pending_resolved_by?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          doc_request_id?: string
          id?: string
          is_pending?: boolean
          mentioned_user_ids?: string[] | null
          pending_resolved_at?: string | null
          pending_resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doc_request_comments_doc_request_id_fkey"
            columns: ["doc_request_id"]
            isOneToOne: false
            referencedRelation: "doc_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_request_deletion_log: {
        Row: {
          action: string
          deleted_at: string | null
          deleted_by: string | null
          doc_request_id: string | null
          id: string
          reason: string
          request_code: number | null
          request_snapshot: Json | null
        }
        Insert: {
          action?: string
          deleted_at?: string | null
          deleted_by?: string | null
          doc_request_id?: string | null
          id?: string
          reason: string
          request_code?: number | null
          request_snapshot?: Json | null
        }
        Update: {
          action?: string
          deleted_at?: string | null
          deleted_by?: string | null
          doc_request_id?: string | null
          id?: string
          reason?: string
          request_code?: number | null
          request_snapshot?: Json | null
        }
        Relationships: []
      }
      doc_request_files: {
        Row: {
          created_at: string
          doc_request_id: string
          file_name: string
          file_path: string
          file_type: string
          id: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          doc_request_id: string
          file_name: string
          file_path: string
          file_type?: string
          id?: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          doc_request_id?: string
          file_name?: string
          file_path?: string
          file_type?: string
          id?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "doc_request_files_doc_request_id_fkey"
            columns: ["doc_request_id"]
            isOneToOne: false
            referencedRelation: "doc_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_request_history: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string
          doc_request_id: string
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string
          doc_request_id: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string
          doc_request_id?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doc_request_history_doc_request_id_fkey"
            columns: ["doc_request_id"]
            isOneToOne: false
            referencedRelation: "doc_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_request_tasks: {
        Row: {
          assigned_to: string | null
          comment_id: string | null
          created_at: string
          created_by: string
          doc_request_id: string
          due_date: string | null
          id: string
          status: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          comment_id?: string | null
          created_at?: string
          created_by: string
          doc_request_id: string
          due_date?: string | null
          id?: string
          status?: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          comment_id?: string | null
          created_at?: string
          created_by?: string
          doc_request_id?: string
          due_date?: string | null
          id?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "doc_request_tasks_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "doc_request_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doc_request_tasks_doc_request_id_fkey"
            columns: ["doc_request_id"]
            isOneToOne: false
            referencedRelation: "doc_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_request_types: {
        Row: {
          category: string | null
          checklist_template: Json | null
          created_at: string
          created_by: string | null
          id: string
          model: string | null
          name: string
          required_fields: Json | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          checklist_template?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          model?: string | null
          name: string
          required_fields?: Json | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          checklist_template?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          model?: string | null
          name?: string
          required_fields?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      doc_requests: {
        Row: {
          ai_summary: string | null
          ai_summary_generated_at: string | null
          base_document_path: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          divida_franquia: number | null
          divida_franquia_juros: number | null
          divida_franquia_multa: number | null
          divida_marketing: number | null
          divida_marketing_juros: number | null
          divida_marketing_multa: number | null
          divida_royalties: number | null
          divida_royalties_juros: number | null
          divida_royalties_multa: number | null
          document_type_id: string | null
          due_date: string | null
          final_document_path: string | null
          franchisee_name: string | null
          giracredito_action: string | null
          giracredito_destination_franchisee_name: string | null
          giracredito_destination_unit_code: string | null
          giracredito_destination_unit_name: string | null
          giracredito_value: number | null
          has_divida: boolean | null
          has_giracredito: boolean | null
          has_multa: boolean | null
          has_territory_change: boolean | null
          has_trespasse: boolean | null
          id: string
          internal_notes: string | null
          internal_responsible_id: string | null
          internal_responsible_name: string | null
          is_completed: boolean | null
          is_document_ready: boolean | null
          is_draft: boolean
          is_overdue: boolean | null
          is_paused: boolean
          is_sent: boolean | null
          is_signed: boolean | null
          is_with_legal: boolean | null
          last_edited_by: string | null
          legal_responsible_id: string | null
          legal_responsible_name: string | null
          multa_value: number | null
          overdue_reason: string | null
          pause_reason: string | null
          priority: string
          reason: string | null
          recipient_doc_id_path: string | null
          recipient_email: string | null
          recipient_marital_status: string | null
          recipient_marriage_cert_path: string | null
          recipient_name: string | null
          recipient_phone: string | null
          recipient_proof_address_path: string | null
          recipient_qualification: string | null
          recipient_qualification_status: string | null
          recipient_role: string | null
          renovacao_flow_run_id: string | null
          request_code: number
          requested_by: string | null
          require_doc_id: boolean
          require_marriage_cert: boolean
          require_proof_address: boolean
          responsible_sector: string | null
          sender_name: string | null
          sender_user_id: string | null
          signature_date: string | null
          signature_status: string
          signed_document_path: string | null
          source_task_id: string | null
          status: string
          store_closing: boolean | null
          store_last_day: string | null
          summary: string | null
          territory_map_link: string | null
          territory_map_path: string | null
          title: string | null
          tratativa: string | null
          trespasse_value: number | null
          unit_city: string | null
          unit_code: string | null
          unit_name: string | null
          unit_state: string | null
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          ai_summary_generated_at?: string | null
          base_document_path?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          divida_franquia?: number | null
          divida_franquia_juros?: number | null
          divida_franquia_multa?: number | null
          divida_marketing?: number | null
          divida_marketing_juros?: number | null
          divida_marketing_multa?: number | null
          divida_royalties?: number | null
          divida_royalties_juros?: number | null
          divida_royalties_multa?: number | null
          document_type_id?: string | null
          due_date?: string | null
          final_document_path?: string | null
          franchisee_name?: string | null
          giracredito_action?: string | null
          giracredito_destination_franchisee_name?: string | null
          giracredito_destination_unit_code?: string | null
          giracredito_destination_unit_name?: string | null
          giracredito_value?: number | null
          has_divida?: boolean | null
          has_giracredito?: boolean | null
          has_multa?: boolean | null
          has_territory_change?: boolean | null
          has_trespasse?: boolean | null
          id?: string
          internal_notes?: string | null
          internal_responsible_id?: string | null
          internal_responsible_name?: string | null
          is_completed?: boolean | null
          is_document_ready?: boolean | null
          is_draft?: boolean
          is_overdue?: boolean | null
          is_paused?: boolean
          is_sent?: boolean | null
          is_signed?: boolean | null
          is_with_legal?: boolean | null
          last_edited_by?: string | null
          legal_responsible_id?: string | null
          legal_responsible_name?: string | null
          multa_value?: number | null
          overdue_reason?: string | null
          pause_reason?: string | null
          priority?: string
          reason?: string | null
          recipient_doc_id_path?: string | null
          recipient_email?: string | null
          recipient_marital_status?: string | null
          recipient_marriage_cert_path?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          recipient_proof_address_path?: string | null
          recipient_qualification?: string | null
          recipient_qualification_status?: string | null
          recipient_role?: string | null
          renovacao_flow_run_id?: string | null
          request_code?: number
          requested_by?: string | null
          require_doc_id?: boolean
          require_marriage_cert?: boolean
          require_proof_address?: boolean
          responsible_sector?: string | null
          sender_name?: string | null
          sender_user_id?: string | null
          signature_date?: string | null
          signature_status?: string
          signed_document_path?: string | null
          source_task_id?: string | null
          status?: string
          store_closing?: boolean | null
          store_last_day?: string | null
          summary?: string | null
          territory_map_link?: string | null
          territory_map_path?: string | null
          title?: string | null
          tratativa?: string | null
          trespasse_value?: number | null
          unit_city?: string | null
          unit_code?: string | null
          unit_name?: string | null
          unit_state?: string | null
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          ai_summary_generated_at?: string | null
          base_document_path?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          divida_franquia?: number | null
          divida_franquia_juros?: number | null
          divida_franquia_multa?: number | null
          divida_marketing?: number | null
          divida_marketing_juros?: number | null
          divida_marketing_multa?: number | null
          divida_royalties?: number | null
          divida_royalties_juros?: number | null
          divida_royalties_multa?: number | null
          document_type_id?: string | null
          due_date?: string | null
          final_document_path?: string | null
          franchisee_name?: string | null
          giracredito_action?: string | null
          giracredito_destination_franchisee_name?: string | null
          giracredito_destination_unit_code?: string | null
          giracredito_destination_unit_name?: string | null
          giracredito_value?: number | null
          has_divida?: boolean | null
          has_giracredito?: boolean | null
          has_multa?: boolean | null
          has_territory_change?: boolean | null
          has_trespasse?: boolean | null
          id?: string
          internal_notes?: string | null
          internal_responsible_id?: string | null
          internal_responsible_name?: string | null
          is_completed?: boolean | null
          is_document_ready?: boolean | null
          is_draft?: boolean
          is_overdue?: boolean | null
          is_paused?: boolean
          is_sent?: boolean | null
          is_signed?: boolean | null
          is_with_legal?: boolean | null
          last_edited_by?: string | null
          legal_responsible_id?: string | null
          legal_responsible_name?: string | null
          multa_value?: number | null
          overdue_reason?: string | null
          pause_reason?: string | null
          priority?: string
          reason?: string | null
          recipient_doc_id_path?: string | null
          recipient_email?: string | null
          recipient_marital_status?: string | null
          recipient_marriage_cert_path?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          recipient_proof_address_path?: string | null
          recipient_qualification?: string | null
          recipient_qualification_status?: string | null
          recipient_role?: string | null
          renovacao_flow_run_id?: string | null
          request_code?: number
          requested_by?: string | null
          require_doc_id?: boolean
          require_marriage_cert?: boolean
          require_proof_address?: boolean
          responsible_sector?: string | null
          sender_name?: string | null
          sender_user_id?: string | null
          signature_date?: string | null
          signature_status?: string
          signed_document_path?: string | null
          source_task_id?: string | null
          status?: string
          store_closing?: boolean | null
          store_last_day?: string | null
          summary?: string | null
          territory_map_link?: string | null
          territory_map_path?: string | null
          title?: string | null
          tratativa?: string | null
          trespasse_value?: number | null
          unit_city?: string | null
          unit_code?: string | null
          unit_name?: string | null
          unit_state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doc_requests_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "doc_request_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doc_requests_renovacao_flow_run_id_fkey"
            columns: ["renovacao_flow_run_id"]
            isOneToOne: false
            referencedRelation: "renovacao_flow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          content: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          id?: number
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          id?: number
          metadata?: Json | null
        }
        Relationships: []
      }
      global_kanban_settings: {
        Row: {
          created_at: string | null
          custom_labels: Json | null
          custom_stages: string[] | null
          id: string
          lost_reasons: string[] | null
          stage_notification_recipients: Json | null
          stage_order: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custom_labels?: Json | null
          custom_stages?: string[] | null
          id?: string
          lost_reasons?: string[] | null
          stage_notification_recipients?: Json | null
          stage_order?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custom_labels?: Json | null
          custom_stages?: string[] | null
          id?: string
          lost_reasons?: string[] | null
          stage_notification_recipients?: Json | null
          stage_order?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      google_oauth_tokens: {
        Row: {
          access_token: string
          connected_at: string | null
          connected_by: string | null
          connected_email: string | null
          expires_at: string
          id: string
          refresh_token: string | null
          scope: string | null
          token_type: string | null
          updated_at: string | null
        }
        Insert: {
          access_token: string
          connected_at?: string | null
          connected_by?: string | null
          connected_email?: string | null
          expires_at: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          connected_at?: string | null
          connected_by?: string | null
          connected_email?: string | null
          expires_at?: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      imagem_IA: {
        Row: {
          created_at: string
          id: number
        }
        Insert: {
          created_at?: string
          id?: number
        }
        Update: {
          created_at?: string
          id?: number
        }
        Relationships: []
      }
      kanban_boards: {
        Row: {
          created_at: string | null
          created_by: string
          custom_labels: Json | null
          description: string | null
          filters: Json
          id: string
          is_global: boolean
          name: string
          sort_order: number
          stage_order: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          custom_labels?: Json | null
          description?: string | null
          filters?: Json
          id?: string
          is_global?: boolean
          name: string
          sort_order?: number
          stage_order?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          custom_labels?: Json | null
          description?: string | null
          filters?: Json
          id?: string
          is_global?: boolean
          name?: string
          sort_order?: number
          stage_order?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      lead_database: {
        Row: {
          city: string | null
          country_code: string
          created_at: string
          created_by: string | null
          ddd: string | null
          franchisee_match_type: string | null
          franchisee_matched_at: string | null
          franchisee_profile_id: string | null
          franchisee_unit_code: string | null
          franchisee_unit_name: string | null
          id: string
          import_batch_id: string | null
          invalid_reason: string | null
          is_franchisee: boolean
          is_valid: boolean
          kanban_lead_id: string | null
          name: string | null
          notes: string | null
          origin: string
          phone_normalized: string
          phone_raw: string | null
          promoted_lead_id: string | null
          region: string | null
          source: string | null
          state: string | null
          status: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          city?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          ddd?: string | null
          franchisee_match_type?: string | null
          franchisee_matched_at?: string | null
          franchisee_profile_id?: string | null
          franchisee_unit_code?: string | null
          franchisee_unit_name?: string | null
          id?: string
          import_batch_id?: string | null
          invalid_reason?: string | null
          is_franchisee?: boolean
          is_valid?: boolean
          kanban_lead_id?: string | null
          name?: string | null
          notes?: string | null
          origin?: string
          phone_normalized: string
          phone_raw?: string | null
          promoted_lead_id?: string | null
          region?: string | null
          source?: string | null
          state?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          city?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          ddd?: string | null
          franchisee_match_type?: string | null
          franchisee_matched_at?: string | null
          franchisee_profile_id?: string | null
          franchisee_unit_code?: string | null
          franchisee_unit_name?: string | null
          id?: string
          import_batch_id?: string | null
          invalid_reason?: string | null
          is_franchisee?: boolean
          is_valid?: boolean
          kanban_lead_id?: string | null
          name?: string | null
          notes?: string | null
          origin?: string
          phone_normalized?: string
          phone_raw?: string | null
          promoted_lead_id?: string | null
          region?: string | null
          source?: string | null
          state?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_database_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "lead_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_database_tags: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      lead_documents: {
        Row: {
          content_type: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          lead_id: string
          uploaded_by: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          lead_id: string
          uploaded_by?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          lead_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_export_batches: {
        Row: {
          created_at: string
          created_by: string | null
          file_name: string
          filters_snapshot: Json | null
          format: string
          id: string
          lead_ids: string[]
          scope: string
          total_rows: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_name: string
          filters_snapshot?: Json | null
          format: string
          id?: string
          lead_ids?: string[]
          scope: string
          total_rows?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_name?: string
          filters_snapshot?: Json | null
          format?: string
          id?: string
          lead_ids?: string[]
          scope?: string
          total_rows?: number
        }
        Relationships: []
      }
      lead_flow_conversation_state: {
        Row: {
          atualizado_em: string
          campos_pendentes: Json
          contexto: Json
          flow_run_id: string
          lead_id: string
          resumo: string | null
          ultima_intencao: string | null
          ultimo_sentimento: string | null
        }
        Insert: {
          atualizado_em?: string
          campos_pendentes?: Json
          contexto?: Json
          flow_run_id: string
          lead_id: string
          resumo?: string | null
          ultima_intencao?: string | null
          ultimo_sentimento?: string | null
        }
        Update: {
          atualizado_em?: string
          campos_pendentes?: Json
          contexto?: Json
          flow_run_id?: string
          lead_id?: string
          resumo?: string | null
          ultima_intencao?: string | null
          ultimo_sentimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_flow_conversation_state_flow_run_id_fkey"
            columns: ["flow_run_id"]
            isOneToOne: true
            referencedRelation: "lead_flow_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_flow_conversation_state_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_flow_conversation_state_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_flow_messages: {
        Row: {
          attachments: Json
          canal: string
          classificacao: string | null
          classificado_por: string | null
          conteudo: string | null
          created_at: string
          direcao: string
          etapa_key: string | null
          flow_run_id: string
          id: string
          lead_id: string
          raw_payload: Json | null
          status_envio: string | null
          zapi_message_id: string | null
        }
        Insert: {
          attachments?: Json
          canal?: string
          classificacao?: string | null
          classificado_por?: string | null
          conteudo?: string | null
          created_at?: string
          direcao: string
          etapa_key?: string | null
          flow_run_id: string
          id?: string
          lead_id: string
          raw_payload?: Json | null
          status_envio?: string | null
          zapi_message_id?: string | null
        }
        Update: {
          attachments?: Json
          canal?: string
          classificacao?: string | null
          classificado_por?: string | null
          conteudo?: string | null
          created_at?: string
          direcao?: string
          etapa_key?: string | null
          flow_run_id?: string
          id?: string
          lead_id?: string
          raw_payload?: Json | null
          status_envio?: string | null
          zapi_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_flow_messages_flow_run_id_fkey"
            columns: ["flow_run_id"]
            isOneToOne: false
            referencedRelation: "lead_flow_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_flow_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_flow_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_flow_runs: {
        Row: {
          assumido_por: string | null
          atualizado_em: string
          bloqueada: boolean
          concluido_em: string | null
          etapa_atual: string
          followup_count: number
          id: string
          iniciado_em: string
          lead_id: string
          metadata: Json
          motivo_bloqueio: string | null
          proxima_acao_em: string | null
          rita_pausada_ate: string | null
          status: string
        }
        Insert: {
          assumido_por?: string | null
          atualizado_em?: string
          bloqueada?: boolean
          concluido_em?: string | null
          etapa_atual: string
          followup_count?: number
          id?: string
          iniciado_em?: string
          lead_id: string
          metadata?: Json
          motivo_bloqueio?: string | null
          proxima_acao_em?: string | null
          rita_pausada_ate?: string | null
          status?: string
        }
        Update: {
          assumido_por?: string | null
          atualizado_em?: string
          bloqueada?: boolean
          concluido_em?: string | null
          etapa_atual?: string
          followup_count?: number
          id?: string
          iniciado_em?: string
          lead_id?: string
          metadata?: Json
          motivo_bloqueio?: string | null
          proxima_acao_em?: string | null
          rita_pausada_ate?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_flow_runs_assumido_por_fkey"
            columns: ["assumido_por"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "lead_flow_runs_assumido_por_fkey"
            columns: ["assumido_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_flow_runs_etapa_atual_fkey"
            columns: ["etapa_atual"]
            isOneToOne: false
            referencedRelation: "lead_flow_steps"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "lead_flow_runs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_flow_runs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_flow_steps: {
        Row: {
          created_at: string
          fase: number
          followup_horas: number | null
          key: string
          meta: Json
          nome: string
          ordem: number
          proxima_etapa_default: string | null
          template_prompt_type: string | null
          timeout_horas: number | null
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fase?: number
          followup_horas?: number | null
          key: string
          meta?: Json
          nome: string
          ordem?: number
          proxima_etapa_default?: string | null
          template_prompt_type?: string | null
          timeout_horas?: number | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fase?: number
          followup_horas?: number | null
          key?: string
          meta?: Json
          nome?: string
          ordem?: number
          proxima_etapa_default?: string | null
          template_prompt_type?: string | null
          timeout_horas?: number | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_import_batches: {
        Row: {
          created_at: string
          created_by: string | null
          duplicate_rows: number
          file_name: string
          id: string
          invalid_rows: number
          no_ddd_rows: number
          total_rows: number
          valid_rows: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duplicate_rows?: number
          file_name: string
          id?: string
          invalid_rows?: number
          no_ddd_rows?: number
          total_rows?: number
          valid_rows?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duplicate_rows?: number
          file_name?: string
          id?: string
          invalid_rows?: number
          no_ddd_rows?: number
          total_rows?: number
          valid_rows?: number
        }
        Relationships: []
      }
      lead_materials: {
        Row: {
          content: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          lead_id: string
          title: string
          type: string
          url: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          lead_id: string
          title: string
          type: string
          url?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          lead_id?: string
          title?: string
          type?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_materials_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_materials_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          audio_url: string | null
          content: string
          created_at: string
          created_by: string | null
          google_calendar_event_id: string | null
          google_calendar_sync_status: string | null
          google_meet_link: string | null
          id: string
          last_sync_error: string | null
          lead_id: string | null
          meeting_attendees: string[] | null
          mentioned_user_ids: string[] | null
          responsible_user_id: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          audio_url?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          google_calendar_event_id?: string | null
          google_calendar_sync_status?: string | null
          google_meet_link?: string | null
          id?: string
          last_sync_error?: string | null
          lead_id?: string | null
          meeting_attendees?: string[] | null
          mentioned_user_ids?: string[] | null
          responsible_user_id?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          audio_url?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          google_calendar_event_id?: string | null
          google_calendar_sync_status?: string | null
          google_meet_link?: string | null
          id?: string
          last_sync_error?: string | null
          lead_id?: string | null
          meeting_attendees?: string[] | null
          mentioned_user_ids?: string[] | null
          responsible_user_id?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "lead_notes_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_score_recalc_queue: {
        Row: {
          attempts: number
          last_error: string | null
          lead_id: string
          processed_at: string | null
          reason: string
          requested_at: string
        }
        Insert: {
          attempts?: number
          last_error?: string | null
          lead_id: string
          processed_at?: string | null
          reason: string
          requested_at?: string
        }
        Update: {
          attempts?: number
          last_error?: string | null
          lead_id?: string
          processed_at?: string | null
          reason?: string
          requested_at?: string
        }
        Relationships: []
      }
      lead_score_results: {
        Row: {
          classification: string
          concerns: Json | null
          created_at: string | null
          factors: Json | null
          general_analysis: string | null
          id: string
          lead_id: string
          next_steps: Json | null
          recommendation: string | null
          risk_level: string | null
          score: number
          strengths: Json | null
          summary: string | null
          transcription_reading: string | null
        }
        Insert: {
          classification: string
          concerns?: Json | null
          created_at?: string | null
          factors?: Json | null
          general_analysis?: string | null
          id?: string
          lead_id: string
          next_steps?: Json | null
          recommendation?: string | null
          risk_level?: string | null
          score: number
          strengths?: Json | null
          summary?: string | null
          transcription_reading?: string | null
        }
        Update: {
          classification?: string
          concerns?: Json | null
          created_at?: string | null
          factors?: Json | null
          general_analysis?: string | null
          id?: string
          lead_id?: string
          next_steps?: Json | null
          recommendation?: string | null
          risk_level?: string | null
          score?: number
          strengths?: Json | null
          summary?: string | null
          transcription_reading?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_score_results_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_score_results_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          created_at: string
          id: string
          lead_id: string
          new_stage: string
          old_stage: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          lead_id: string
          new_stage: string
          old_stage: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          new_stage?: string
          old_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_stage_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_stage_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          "1º_follow_up": string | null
          "2º_follow_up": string | null
          "3º_follow_up": string | null
          additional_contact_name: string | null
          administrative_responsible_id: string | null
          assigned_to: string | null
          board_id: string | null
          cidade_natal: string | null
          city: string | null
          city_available: boolean | null
          city_of_interest: string | null
          commercial_responsible_id: string | null
          como_conheceu_detalhes: string | null
          como_conheceu_franquia: string | null
          contact_source: string | null
          contract_signature_date: string | null
          country_of_interest: string | null
          cpf: string | null
          created_at: string
          data_reunião: string | null
          date_of_birth: string | null
          disponibilidade_dedicacao: string | null
          email: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_complemento: string | null
          endereco_estado: string | null
          endereco_logradouro: string | null
          endereco_numero: string | null
          endereco_uf: string | null
          escolaridade: string | null
          faixa_salarial_anterior: string | null
          foi_indicado: boolean | null
          franchise_fee_payment_date: string | null
          franqueado_id: string | null
          franqueado_unidade_link_error: string | null
          franqueado_unidade_linked: boolean | null
          hora_mensagem: string | null
          id: string
          indicado_por: string | null
          instagram_pessoal: string | null
          interest: string | null
          investment: string | null
          ja_foi_empreendedor: boolean | null
          last_contact: string | null
          last_franqueado_unidade_link_attempt: string | null
          last_sync_attempt: string | null
          last_unidades_sync_attempt: string | null
          lead_score: number | null
          link_zoom: string | null
          lost_reason: string | null
          modelo_loja: string | null
          name: string | null
          nationality: string | null
          nearest_available_city: string | null
          next_contact: string | null
          nome_unidade: string | null
          num_whatsapp_lead: string | null
          numero_habitantes: string | null
          operator_name: string | null
          phone: string | null
          possui_outras_atividades: boolean | null
          preferred_language: string | null
          profissao_anterior: string | null
          recebe_pro_labore: boolean | null
          reu_horario_exato: string | null
          sdr_responsible_id: string | null
          source: string | null
          stage: string | null
          state: string | null
          state_of_interest: string | null
          sync_error: string | null
          synced_to_franqueados: boolean | null
          synced_to_unidades: boolean | null
          tags: string[] | null
          termo_sigilo_sent: boolean | null
          thread_id: string | null
          timeout: string | null
          tipo_proprietario: string | null
          unidade_id: string | null
          unidades_sync_error: string | null
          updated_at: string | null
        }
        Insert: {
          "1º_follow_up"?: string | null
          "2º_follow_up"?: string | null
          "3º_follow_up"?: string | null
          additional_contact_name?: string | null
          administrative_responsible_id?: string | null
          assigned_to?: string | null
          board_id?: string | null
          cidade_natal?: string | null
          city?: string | null
          city_available?: boolean | null
          city_of_interest?: string | null
          commercial_responsible_id?: string | null
          como_conheceu_detalhes?: string | null
          como_conheceu_franquia?: string | null
          contact_source?: string | null
          contract_signature_date?: string | null
          country_of_interest?: string | null
          cpf?: string | null
          created_at?: string
          data_reunião?: string | null
          date_of_birth?: string | null
          disponibilidade_dedicacao?: string | null
          email?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          endereco_uf?: string | null
          escolaridade?: string | null
          faixa_salarial_anterior?: string | null
          foi_indicado?: boolean | null
          franchise_fee_payment_date?: string | null
          franqueado_id?: string | null
          franqueado_unidade_link_error?: string | null
          franqueado_unidade_linked?: boolean | null
          hora_mensagem?: string | null
          id?: string
          indicado_por?: string | null
          instagram_pessoal?: string | null
          interest?: string | null
          investment?: string | null
          ja_foi_empreendedor?: boolean | null
          last_contact?: string | null
          last_franqueado_unidade_link_attempt?: string | null
          last_sync_attempt?: string | null
          last_unidades_sync_attempt?: string | null
          lead_score?: number | null
          link_zoom?: string | null
          lost_reason?: string | null
          modelo_loja?: string | null
          name?: string | null
          nationality?: string | null
          nearest_available_city?: string | null
          next_contact?: string | null
          nome_unidade?: string | null
          num_whatsapp_lead?: string | null
          numero_habitantes?: string | null
          operator_name?: string | null
          phone?: string | null
          possui_outras_atividades?: boolean | null
          preferred_language?: string | null
          profissao_anterior?: string | null
          recebe_pro_labore?: boolean | null
          reu_horario_exato?: string | null
          sdr_responsible_id?: string | null
          source?: string | null
          stage?: string | null
          state?: string | null
          state_of_interest?: string | null
          sync_error?: string | null
          synced_to_franqueados?: boolean | null
          synced_to_unidades?: boolean | null
          tags?: string[] | null
          termo_sigilo_sent?: boolean | null
          thread_id?: string | null
          timeout?: string | null
          tipo_proprietario?: string | null
          unidade_id?: string | null
          unidades_sync_error?: string | null
          updated_at?: string | null
        }
        Update: {
          "1º_follow_up"?: string | null
          "2º_follow_up"?: string | null
          "3º_follow_up"?: string | null
          additional_contact_name?: string | null
          administrative_responsible_id?: string | null
          assigned_to?: string | null
          board_id?: string | null
          cidade_natal?: string | null
          city?: string | null
          city_available?: boolean | null
          city_of_interest?: string | null
          commercial_responsible_id?: string | null
          como_conheceu_detalhes?: string | null
          como_conheceu_franquia?: string | null
          contact_source?: string | null
          contract_signature_date?: string | null
          country_of_interest?: string | null
          cpf?: string | null
          created_at?: string
          data_reunião?: string | null
          date_of_birth?: string | null
          disponibilidade_dedicacao?: string | null
          email?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          endereco_uf?: string | null
          escolaridade?: string | null
          faixa_salarial_anterior?: string | null
          foi_indicado?: boolean | null
          franchise_fee_payment_date?: string | null
          franqueado_id?: string | null
          franqueado_unidade_link_error?: string | null
          franqueado_unidade_linked?: boolean | null
          hora_mensagem?: string | null
          id?: string
          indicado_por?: string | null
          instagram_pessoal?: string | null
          interest?: string | null
          investment?: string | null
          ja_foi_empreendedor?: boolean | null
          last_contact?: string | null
          last_franqueado_unidade_link_attempt?: string | null
          last_sync_attempt?: string | null
          last_unidades_sync_attempt?: string | null
          lead_score?: number | null
          link_zoom?: string | null
          lost_reason?: string | null
          modelo_loja?: string | null
          name?: string | null
          nationality?: string | null
          nearest_available_city?: string | null
          next_contact?: string | null
          nome_unidade?: string | null
          num_whatsapp_lead?: string | null
          numero_habitantes?: string | null
          operator_name?: string | null
          phone?: string | null
          possui_outras_atividades?: boolean | null
          preferred_language?: string | null
          profissao_anterior?: string | null
          recebe_pro_labore?: boolean | null
          reu_horario_exato?: string | null
          sdr_responsible_id?: string | null
          source?: string | null
          stage?: string | null
          state?: string | null
          state_of_interest?: string | null
          sync_error?: string | null
          synced_to_franqueados?: boolean | null
          synced_to_unidades?: boolean | null
          tags?: string[] | null
          termo_sigilo_sent?: boolean | null
          thread_id?: string | null
          timeout?: string | null
          tipo_proprietario?: string | null
          unidade_id?: string | null
          unidades_sync_error?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "kanban_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      level_permissions: {
        Row: {
          created_at: string | null
          enabled: boolean
          id: string
          nivel_value: string
          permission_key: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean
          id?: string
          nivel_value: string
          permission_key: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean
          id?: string
          nivel_value?: string
          permission_key?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      meeting_telemetry: {
        Row: {
          created_at: string
          event: string
          id: string
          payload: Json
          reuniao_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          payload?: Json
          reuniao_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          payload?: Json
          reuniao_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_telemetry_reuniao_id_fkey"
            columns: ["reuniao_id"]
            isOneToOne: false
            referencedRelation: "reunioes"
            referencedColumns: ["id"]
          },
        ]
      }
      motivational_phrases: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          phrase: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          phrase: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          phrase?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json | null
          read: boolean
          source_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean
          source_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean
          source_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      operation_alerts: {
        Row: {
          alert_type: string
          created_at: string
          dismissed_at: string | null
          dismissed_by: string | null
          id: string
          message: string
          metadata: Json | null
          operation_id: string
          severity: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          id?: string
          message: string
          metadata?: Json | null
          operation_id: string
          severity?: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          operation_id?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "operation_alerts_dismissed_by_fkey"
            columns: ["dismissed_by"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "operation_alerts_dismissed_by_fkey"
            columns: ["dismissed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_alerts_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          field_changed: string
          id: string
          new_value: string | null
          old_value: string | null
          operation_id: string
          source_id: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          field_changed: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          operation_id: string
          source_id?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          field_changed?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          operation_id?: string
          source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operation_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "operation_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_history_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_history_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "operation_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_history_aggregates: {
        Row: {
          count: number
          created_at: string
          created_by: string | null
          id: string
          month: number
          notes: string | null
          operation_type: string
          source_upload_id: string | null
          updated_at: string
          year: number
        }
        Insert: {
          count?: number
          created_at?: string
          created_by?: string | null
          id?: string
          month: number
          notes?: string | null
          operation_type: string
          source_upload_id?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          count?: number
          created_at?: string
          created_by?: string | null
          id?: string
          month?: number
          notes?: string | null
          operation_type?: string
          source_upload_id?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "operation_history_aggregates_source_upload_id_fkey"
            columns: ["source_upload_id"]
            isOneToOne: false
            referencedRelation: "operation_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_sources: {
        Row: {
          confidence: number | null
          created_at: string
          created_by: string | null
          extracted_payload: Json | null
          id: string
          operation_id: string
          source_doc_request_id: string | null
          source_file_path: string | null
          source_type: string
          source_upload_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          extracted_payload?: Json | null
          id?: string
          operation_id: string
          source_doc_request_id?: string | null
          source_file_path?: string | null
          source_type: string
          source_upload_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          extracted_payload?: Json | null
          id?: string
          operation_id?: string
          source_doc_request_id?: string | null
          source_file_path?: string | null
          source_type?: string
          source_upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operation_sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "operation_sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_sources_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_unit_aliases: {
        Row: {
          alias: string
          alias_normalized: string
          confidence: number | null
          created_at: string
          created_by: string | null
          id: string
          unit_canonical_name: string
          unit_code: string | null
          unit_external_id: string
        }
        Insert: {
          alias: string
          alias_normalized: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          unit_canonical_name: string
          unit_code?: string | null
          unit_external_id: string
        }
        Update: {
          alias?: string
          alias_normalized?: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          unit_canonical_name?: string
          unit_code?: string | null
          unit_external_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operation_unit_aliases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "operation_unit_aliases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_uploads: {
        Row: {
          aggregates_created: number
          created_at: string
          error_message: string | null
          extracted_rows: Json | null
          file_name: string
          file_path: string
          file_type: string
          id: string
          operations_created: number | null
          processing_status: string
          raw_ocr: string | null
          rows_count: number | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          aggregates_created?: number
          created_at?: string
          error_message?: string | null
          extracted_rows?: Json | null
          file_name: string
          file_path: string
          file_type: string
          id?: string
          operations_created?: number | null
          processing_status?: string
          raw_ocr?: string | null
          rows_count?: number | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          aggregates_created?: number
          created_at?: string
          error_message?: string | null
          extracted_rows?: Json | null
          file_name?: string
          file_path?: string
          file_type?: string
          id?: string
          operations_created?: number | null
          processing_status?: string
          raw_ocr?: string | null
          rows_count?: number | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operation_uploads_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "operation_uploads_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      operations: {
        Row: {
          completed_at: string | null
          confidence_score: number | null
          created_at: string
          created_by: string | null
          franchisee_name: string | null
          id: string
          last_activity_at: string | null
          metadata: Json | null
          motivo: string | null
          observacoes: string | null
          operation_type: string
          requires_validation: boolean
          responsible_user_id: string | null
          started_at: string | null
          status: string
          unit_canonical_name: string | null
          unit_city: string | null
          unit_code: string | null
          unit_external_id: string | null
          unit_state: string | null
          updated_at: string
          valor_divida: number | null
          valor_repasse: number | null
          valor_venda: number | null
          vigencia_ate: string | null
        }
        Insert: {
          completed_at?: string | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          franchisee_name?: string | null
          id?: string
          last_activity_at?: string | null
          metadata?: Json | null
          motivo?: string | null
          observacoes?: string | null
          operation_type: string
          requires_validation?: boolean
          responsible_user_id?: string | null
          started_at?: string | null
          status?: string
          unit_canonical_name?: string | null
          unit_city?: string | null
          unit_code?: string | null
          unit_external_id?: string | null
          unit_state?: string | null
          updated_at?: string
          valor_divida?: number | null
          valor_repasse?: number | null
          valor_venda?: number | null
          vigencia_ate?: string | null
        }
        Update: {
          completed_at?: string | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          franchisee_name?: string | null
          id?: string
          last_activity_at?: string | null
          metadata?: Json | null
          motivo?: string | null
          observacoes?: string | null
          operation_type?: string
          requires_validation?: boolean
          responsible_user_id?: string | null
          started_at?: string | null
          status?: string
          unit_canonical_name?: string | null
          unit_city?: string | null
          unit_code?: string | null
          unit_external_id?: string | null
          unit_state?: string | null
          updated_at?: string
          valor_divida?: number | null
          valor_repasse?: number | null
          valor_venda?: number | null
          vigencia_ate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "operations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operations_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "operations_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      prospeccao_custom_options: {
        Row: {
          created_at: string
          created_by: string | null
          field: string
          id: string
          value: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          field: string
          id?: string
          value: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          field?: string
          id?: string
          value?: string
        }
        Relationships: []
      }
      prospeccao_leads: {
        Row: {
          cidade_direcionar: string | null
          cidade_lead: string | null
          created_at: string
          created_by: string | null
          data_proximo_contato: string | null
          de_onde_veio: string | null
          historico: Json
          id: string
          nome: string
          observacoes: string | null
          potencial: string
          prioridade: string
          proxima_acao: string | null
          situacao: string
          status: string
          telefone: string
          ultimo_contato: string | null
          updated_at: string
        }
        Insert: {
          cidade_direcionar?: string | null
          cidade_lead?: string | null
          created_at?: string
          created_by?: string | null
          data_proximo_contato?: string | null
          de_onde_veio?: string | null
          historico?: Json
          id?: string
          nome?: string
          observacoes?: string | null
          potencial?: string
          prioridade?: string
          proxima_acao?: string | null
          situacao?: string
          status?: string
          telefone?: string
          ultimo_contato?: string | null
          updated_at?: string
        }
        Update: {
          cidade_direcionar?: string | null
          cidade_lead?: string | null
          created_at?: string
          created_by?: string | null
          data_proximo_contato?: string | null
          de_onde_veio?: string | null
          historico?: Json
          id?: string
          nome?: string
          observacoes?: string | null
          potencial?: string
          prioridade?: string
          proxima_acao?: string | null
          situacao?: string
          status?: string
          telefone?: string
          ultimo_contato?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ranking_reports: {
        Row: {
          created_at: string | null
          generated_at: string | null
          id: string
          month_year: string
          report_data: Json
        }
        Insert: {
          created_at?: string | null
          generated_at?: string | null
          id?: string
          month_year: string
          report_data?: Json
        }
        Update: {
          created_at?: string | null
          generated_at?: string | null
          id?: string
          month_year?: string
          report_data?: Json
        }
        Relationships: []
      }
      renovacao_alerts: {
        Row: {
          created_at: string
          dismissed_at: string | null
          dismissed_by: string | null
          dispatched_channels: Json
          id: string
          message: string
          renovacao_id: string
          severity: string
          tipo: string
        }
        Insert: {
          created_at?: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          dispatched_channels?: Json
          id?: string
          message: string
          renovacao_id: string
          severity?: string
          tipo: string
        }
        Update: {
          created_at?: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          dispatched_channels?: Json
          id?: string
          message?: string
          renovacao_id?: string
          severity?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "renovacao_alerts_dismissed_by_fkey"
            columns: ["dismissed_by"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "renovacao_alerts_dismissed_by_fkey"
            columns: ["dismissed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renovacao_alerts_renovacao_id_fkey"
            columns: ["renovacao_id"]
            isOneToOne: false
            referencedRelation: "renovacoes_2026"
            referencedColumns: ["id"]
          },
        ]
      }
      renovacao_comments: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          is_pending: boolean
          mentioned_user_ids: string[]
          pending_resolved_at: string | null
          pending_resolved_by: string | null
          renovacao_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          is_pending?: boolean
          mentioned_user_ids?: string[]
          pending_resolved_at?: string | null
          pending_resolved_by?: string | null
          renovacao_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_pending?: boolean
          mentioned_user_ids?: string[]
          pending_resolved_at?: string | null
          pending_resolved_by?: string | null
          renovacao_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "renovacao_comments_renovacao_id_fkey"
            columns: ["renovacao_id"]
            isOneToOne: false
            referencedRelation: "renovacoes_2026"
            referencedColumns: ["id"]
          },
        ]
      }
      renovacao_flow_billing: {
        Row: {
          arquivo_path: string | null
          comprovante_path: string | null
          created_at: string
          created_by: string | null
          enviado_em: string | null
          flow_run_id: string
          followup_count: number
          id: string
          link_pagamento: string | null
          metodo: string
          observacao: string | null
          pago_em: string | null
          renovacao_id: string
          status: string
          updated_at: string
          valor: number
          valor_pago: number | null
          vencimento: string
          verificacao_observacao: string | null
          verificacao_status: string
          verificado_em: string | null
          verificado_por: string | null
        }
        Insert: {
          arquivo_path?: string | null
          comprovante_path?: string | null
          created_at?: string
          created_by?: string | null
          enviado_em?: string | null
          flow_run_id: string
          followup_count?: number
          id?: string
          link_pagamento?: string | null
          metodo: string
          observacao?: string | null
          pago_em?: string | null
          renovacao_id: string
          status?: string
          updated_at?: string
          valor: number
          valor_pago?: number | null
          vencimento: string
          verificacao_observacao?: string | null
          verificacao_status?: string
          verificado_em?: string | null
          verificado_por?: string | null
        }
        Update: {
          arquivo_path?: string | null
          comprovante_path?: string | null
          created_at?: string
          created_by?: string | null
          enviado_em?: string | null
          flow_run_id?: string
          followup_count?: number
          id?: string
          link_pagamento?: string | null
          metodo?: string
          observacao?: string | null
          pago_em?: string | null
          renovacao_id?: string
          status?: string
          updated_at?: string
          valor?: number
          valor_pago?: number | null
          vencimento?: string
          verificacao_observacao?: string | null
          verificacao_status?: string
          verificado_em?: string | null
          verificado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "renovacao_flow_billing_flow_run_id_fkey"
            columns: ["flow_run_id"]
            isOneToOne: false
            referencedRelation: "renovacao_flow_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renovacao_flow_billing_verificado_por_fkey"
            columns: ["verificado_por"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "renovacao_flow_billing_verificado_por_fkey"
            columns: ["verificado_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      renovacao_flow_billing_history: {
        Row: {
          action: string
          billing_id: string
          changed_at: string
          changed_by: string | null
          from_status: string | null
          id: string
          metadata: Json | null
          observacao: string | null
          to_status: string | null
        }
        Insert: {
          action: string
          billing_id: string
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          metadata?: Json | null
          observacao?: string | null
          to_status?: string | null
        }
        Update: {
          action?: string
          billing_id?: string
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          metadata?: Json | null
          observacao?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "renovacao_flow_billing_history_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "renovacao_flow_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renovacao_flow_billing_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "renovacao_flow_billing_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      renovacao_flow_contracts: {
        Row: {
          assinado_em: string | null
          assinado_por_cpf: string | null
          assinado_por_nome: string | null
          created_at: string
          created_by: string | null
          enviado_em: string | null
          flow_run_id: string
          id: string
          observacoes: string | null
          pdf_assinado_path: string | null
          pdf_path: string | null
          proposal_id: string | null
          status: string
          updated_at: string
          versao: number
        }
        Insert: {
          assinado_em?: string | null
          assinado_por_cpf?: string | null
          assinado_por_nome?: string | null
          created_at?: string
          created_by?: string | null
          enviado_em?: string | null
          flow_run_id: string
          id?: string
          observacoes?: string | null
          pdf_assinado_path?: string | null
          pdf_path?: string | null
          proposal_id?: string | null
          status?: string
          updated_at?: string
          versao?: number
        }
        Update: {
          assinado_em?: string | null
          assinado_por_cpf?: string | null
          assinado_por_nome?: string | null
          created_at?: string
          created_by?: string | null
          enviado_em?: string | null
          flow_run_id?: string
          id?: string
          observacoes?: string | null
          pdf_assinado_path?: string | null
          pdf_path?: string | null
          proposal_id?: string | null
          status?: string
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "renovacao_flow_contracts_flow_run_id_fkey"
            columns: ["flow_run_id"]
            isOneToOne: false
            referencedRelation: "renovacao_flow_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renovacao_flow_contracts_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "renovacao_flow_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      renovacao_flow_documents: {
        Row: {
          arquivo_path: string | null
          created_at: string
          flow_run_id: string
          id: string
          item_key: string
          item_label: string
          recebido: boolean
          recebido_em: string | null
        }
        Insert: {
          arquivo_path?: string | null
          created_at?: string
          flow_run_id: string
          id?: string
          item_key: string
          item_label: string
          recebido?: boolean
          recebido_em?: string | null
        }
        Update: {
          arquivo_path?: string | null
          created_at?: string
          flow_run_id?: string
          id?: string
          item_key?: string
          item_label?: string
          recebido?: boolean
          recebido_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "renovacao_flow_documents_flow_run_id_fkey"
            columns: ["flow_run_id"]
            isOneToOne: false
            referencedRelation: "renovacao_flow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      renovacao_flow_meetings: {
        Row: {
          calendar_event_id: string | null
          classificado_em: string | null
          created_at: string
          desfecho: string | null
          desfecho_motivo: string | null
          desfecho_payload: Json | null
          flow_run_id: string
          horario_confirmado: string | null
          id: string
          reuniao_id: string | null
          status: string
          sugestoes_horarios: Json
          updated_at: string
        }
        Insert: {
          calendar_event_id?: string | null
          classificado_em?: string | null
          created_at?: string
          desfecho?: string | null
          desfecho_motivo?: string | null
          desfecho_payload?: Json | null
          flow_run_id: string
          horario_confirmado?: string | null
          id?: string
          reuniao_id?: string | null
          status?: string
          sugestoes_horarios?: Json
          updated_at?: string
        }
        Update: {
          calendar_event_id?: string | null
          classificado_em?: string | null
          created_at?: string
          desfecho?: string | null
          desfecho_motivo?: string | null
          desfecho_payload?: Json | null
          flow_run_id?: string
          horario_confirmado?: string | null
          id?: string
          reuniao_id?: string | null
          status?: string
          sugestoes_horarios?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "renovacao_flow_meetings_flow_run_id_fkey"
            columns: ["flow_run_id"]
            isOneToOne: false
            referencedRelation: "renovacao_flow_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renovacao_flow_meetings_reuniao_id_fkey"
            columns: ["reuniao_id"]
            isOneToOne: false
            referencedRelation: "reunioes"
            referencedColumns: ["id"]
          },
        ]
      }
      renovacao_flow_messages: {
        Row: {
          canal: string
          classificacao: string | null
          classificado_por: string | null
          conteudo: string | null
          created_at: string
          direcao: string
          etapa_key: string
          flow_run_id: string
          id: string
          raw_payload: Json | null
          status_envio: string | null
          zapi_message_id: string | null
        }
        Insert: {
          canal?: string
          classificacao?: string | null
          classificado_por?: string | null
          conteudo?: string | null
          created_at?: string
          direcao: string
          etapa_key: string
          flow_run_id: string
          id?: string
          raw_payload?: Json | null
          status_envio?: string | null
          zapi_message_id?: string | null
        }
        Update: {
          canal?: string
          classificacao?: string | null
          classificado_por?: string | null
          conteudo?: string | null
          created_at?: string
          direcao?: string
          etapa_key?: string
          flow_run_id?: string
          id?: string
          raw_payload?: Json | null
          status_envio?: string | null
          zapi_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "renovacao_flow_messages_flow_run_id_fkey"
            columns: ["flow_run_id"]
            isOneToOne: false
            referencedRelation: "renovacao_flow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      renovacao_flow_proposals: {
        Row: {
          classificacao_motivo: string | null
          condicoes_especiais: Json | null
          created_at: string
          created_by: string | null
          enviada_em: string | null
          flow_run_id: string
          gerada_em: string
          id: string
          pdf_path: string | null
          respondida_em: string | null
          royalties_atual: number | null
          royalties_proposto: number | null
          status: string
          taxa_franquia: number | null
          updated_at: string
          versao: number
          vigencia_anos: number | null
        }
        Insert: {
          classificacao_motivo?: string | null
          condicoes_especiais?: Json | null
          created_at?: string
          created_by?: string | null
          enviada_em?: string | null
          flow_run_id: string
          gerada_em?: string
          id?: string
          pdf_path?: string | null
          respondida_em?: string | null
          royalties_atual?: number | null
          royalties_proposto?: number | null
          status?: string
          taxa_franquia?: number | null
          updated_at?: string
          versao?: number
          vigencia_anos?: number | null
        }
        Update: {
          classificacao_motivo?: string | null
          condicoes_especiais?: Json | null
          created_at?: string
          created_by?: string | null
          enviada_em?: string | null
          flow_run_id?: string
          gerada_em?: string
          id?: string
          pdf_path?: string | null
          respondida_em?: string | null
          royalties_atual?: number | null
          royalties_proposto?: number | null
          status?: string
          taxa_franquia?: number | null
          updated_at?: string
          versao?: number
          vigencia_anos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "renovacao_flow_proposals_flow_run_id_fkey"
            columns: ["flow_run_id"]
            isOneToOne: false
            referencedRelation: "renovacao_flow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      renovacao_flow_runs: {
        Row: {
          atualizado_em: string
          bloqueada: boolean
          concluido_em: string | null
          etapa_atual: string
          followup_count: number
          id: string
          iniciado_em: string
          motivo_bloqueio: string | null
          proxima_acao_em: string | null
          renovacao_id: string
          status: string
        }
        Insert: {
          atualizado_em?: string
          bloqueada?: boolean
          concluido_em?: string | null
          etapa_atual: string
          followup_count?: number
          id?: string
          iniciado_em?: string
          motivo_bloqueio?: string | null
          proxima_acao_em?: string | null
          renovacao_id: string
          status?: string
        }
        Update: {
          atualizado_em?: string
          bloqueada?: boolean
          concluido_em?: string | null
          etapa_atual?: string
          followup_count?: number
          id?: string
          iniciado_em?: string
          motivo_bloqueio?: string | null
          proxima_acao_em?: string | null
          renovacao_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "renovacao_flow_runs_etapa_atual_fkey"
            columns: ["etapa_atual"]
            isOneToOne: false
            referencedRelation: "renovacao_flow_steps"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "renovacao_flow_runs_renovacao_id_fkey"
            columns: ["renovacao_id"]
            isOneToOne: false
            referencedRelation: "renovacoes_2026"
            referencedColumns: ["id"]
          },
        ]
      }
      renovacao_flow_steps: {
        Row: {
          created_at: string
          fase: number
          followup_horas: number | null
          key: string
          nome: string
          ordem: number
          proxima_etapa_default: string | null
          template_prompt_type: string | null
          timeout_horas: number | null
          tipo: string
        }
        Insert: {
          created_at?: string
          fase: number
          followup_horas?: number | null
          key: string
          nome: string
          ordem: number
          proxima_etapa_default?: string | null
          template_prompt_type?: string | null
          timeout_horas?: number | null
          tipo: string
        }
        Update: {
          created_at?: string
          fase?: number
          followup_horas?: number | null
          key?: string
          nome?: string
          ordem?: number
          proxima_etapa_default?: string | null
          template_prompt_type?: string | null
          timeout_horas?: number | null
          tipo?: string
        }
        Relationships: []
      }
      renovacao_flow_transitions: {
        Row: {
          automatica: boolean
          by_user: string | null
          created_at: string
          de: string | null
          flow_run_id: string
          id: string
          metadata: Json | null
          motivo: string | null
          para: string
        }
        Insert: {
          automatica?: boolean
          by_user?: string | null
          created_at?: string
          de?: string | null
          flow_run_id: string
          id?: string
          metadata?: Json | null
          motivo?: string | null
          para: string
        }
        Update: {
          automatica?: boolean
          by_user?: string | null
          created_at?: string
          de?: string | null
          flow_run_id?: string
          id?: string
          metadata?: Json | null
          motivo?: string | null
          para?: string
        }
        Relationships: [
          {
            foreignKeyName: "renovacao_flow_transitions_flow_run_id_fkey"
            columns: ["flow_run_id"]
            isOneToOne: false
            referencedRelation: "renovacao_flow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      renovacao_history: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string
          field_changed: string | null
          id: string
          new_value: string | null
          old_value: string | null
          renovacao_id: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          renovacao_id: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          renovacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "renovacao_history_renovacao_id_fkey"
            columns: ["renovacao_id"]
            isOneToOne: false
            referencedRelation: "renovacoes_2026"
            referencedColumns: ["id"]
          },
        ]
      }
      renovacao_status_options: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          grupo: string
          id: string
          is_default: boolean
          label: string
          ordem: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          grupo: string
          id?: string
          is_default?: boolean
          label: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          grupo?: string
          id?: string
          is_default?: boolean
          label?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      renovacoes_2026: {
        Row: {
          cof_operation_id: string | null
          concluida: boolean
          concluida_em: string | null
          contrato: string | null
          contrato_assinado_em: string | null
          contrato_enviado_em: string | null
          created_at: string
          created_by: string | null
          dias: number | null
          etapas: string | null
          id: string
          last_alert_15d: boolean
          last_alert_30d: boolean
          last_alert_60d: boolean
          last_alert_7d: boolean
          last_alert_parado: boolean
          nao_renovou: boolean
          nao_renovou_em: string | null
          nao_renovou_motivo: string | null
          observacao: string | null
          processo: string | null
          responsavel_user_id: string | null
          royalties_1ano: string | null
          royalties_atual: string | null
          status: string | null
          status_financeiro: string | null
          taxa_franquia: number | null
          taxa_franquia_paga: number | null
          taxa_franquia_status: string | null
          termino: string | null
          termino_date: string | null
          unidade: string
          updated_at: string
          validacao: string | null
          vigencia: string | null
        }
        Insert: {
          cof_operation_id?: string | null
          concluida?: boolean
          concluida_em?: string | null
          contrato?: string | null
          contrato_assinado_em?: string | null
          contrato_enviado_em?: string | null
          created_at?: string
          created_by?: string | null
          dias?: number | null
          etapas?: string | null
          id?: string
          last_alert_15d?: boolean
          last_alert_30d?: boolean
          last_alert_60d?: boolean
          last_alert_7d?: boolean
          last_alert_parado?: boolean
          nao_renovou?: boolean
          nao_renovou_em?: string | null
          nao_renovou_motivo?: string | null
          observacao?: string | null
          processo?: string | null
          responsavel_user_id?: string | null
          royalties_1ano?: string | null
          royalties_atual?: string | null
          status?: string | null
          status_financeiro?: string | null
          taxa_franquia?: number | null
          taxa_franquia_paga?: number | null
          taxa_franquia_status?: string | null
          termino?: string | null
          termino_date?: string | null
          unidade: string
          updated_at?: string
          validacao?: string | null
          vigencia?: string | null
        }
        Update: {
          cof_operation_id?: string | null
          concluida?: boolean
          concluida_em?: string | null
          contrato?: string | null
          contrato_assinado_em?: string | null
          contrato_enviado_em?: string | null
          created_at?: string
          created_by?: string | null
          dias?: number | null
          etapas?: string | null
          id?: string
          last_alert_15d?: boolean
          last_alert_30d?: boolean
          last_alert_60d?: boolean
          last_alert_7d?: boolean
          last_alert_parado?: boolean
          nao_renovou?: boolean
          nao_renovou_em?: string | null
          nao_renovou_motivo?: string | null
          observacao?: string | null
          processo?: string | null
          responsavel_user_id?: string | null
          royalties_1ano?: string | null
          royalties_atual?: string | null
          status?: string | null
          status_financeiro?: string | null
          taxa_franquia?: number | null
          taxa_franquia_paga?: number | null
          taxa_franquia_status?: string | null
          termino?: string | null
          termino_date?: string | null
          unidade?: string
          updated_at?: string
          validacao?: string | null
          vigencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "renovacoes_2026_cof_operation_id_fkey"
            columns: ["cof_operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renovacoes_2026_responsavel_user_id_fkey"
            columns: ["responsavel_user_id"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "renovacoes_2026_responsavel_user_id_fkey"
            columns: ["responsavel_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reuniao_admissoes: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          id: string
          is_guest: boolean
          metadata: Json
          participant_identity: string
          participant_name: string
          requested_at: string
          reuniao_id: string
          status: string
          user_id: string | null
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          is_guest?: boolean
          metadata?: Json
          participant_identity: string
          participant_name: string
          requested_at?: string
          reuniao_id: string
          status?: string
          user_id?: string | null
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          is_guest?: boolean
          metadata?: Json
          participant_identity?: string
          participant_name?: string
          requested_at?: string
          reuniao_id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reuniao_admissoes_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "reuniao_admissoes_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reuniao_admissoes_reuniao_id_fkey"
            columns: ["reuniao_id"]
            isOneToOne: false
            referencedRelation: "reunioes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reuniao_admissoes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "reuniao_admissoes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reuniao_gravacao_eventos: {
        Row: {
          created_at: string
          created_by: string | null
          event_type: string
          gravacao_id: string
          id: string
          message: string | null
          metadata: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_type: string
          gravacao_id: string
          id?: string
          message?: string | null
          metadata?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_type?: string
          gravacao_id?: string
          id?: string
          message?: string | null
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "reuniao_gravacao_eventos_gravacao_id_fkey"
            columns: ["gravacao_id"]
            isOneToOne: false
            referencedRelation: "reuniao_gravacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reuniao_gravacao_eventos_gravacao_id_fkey"
            columns: ["gravacao_id"]
            isOneToOne: false
            referencedRelation: "reuniao_gravacoes_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      reuniao_gravacoes: {
        Row: {
          created_at: string
          duration_seconds: number | null
          egress_id: string | null
          ended_at: string | null
          error_message: string | null
          id: string
          identities_observadas: Json
          injected_at: string | null
          last_transcription_attempt_at: string | null
          last_transcription_error: Json | null
          metadata: Json
          mp4_size_bytes: number | null
          planos_gerados_count: number
          public_url: string | null
          receita_status: string
          reuniao_id: string
          speaker_names: Json
          started_at: string | null
          status: string
          storage_path: string | null
          transcription_attempts: number
          transcription_progress: number | null
          transcription_segments: Json | null
          transcription_stage: string | null
          transcription_status: string
          transcription_text: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          egress_id?: string | null
          ended_at?: string | null
          error_message?: string | null
          id?: string
          identities_observadas?: Json
          injected_at?: string | null
          last_transcription_attempt_at?: string | null
          last_transcription_error?: Json | null
          metadata?: Json
          mp4_size_bytes?: number | null
          planos_gerados_count?: number
          public_url?: string | null
          receita_status?: string
          reuniao_id: string
          speaker_names?: Json
          started_at?: string | null
          status?: string
          storage_path?: string | null
          transcription_attempts?: number
          transcription_progress?: number | null
          transcription_segments?: Json | null
          transcription_stage?: string | null
          transcription_status?: string
          transcription_text?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          egress_id?: string | null
          ended_at?: string | null
          error_message?: string | null
          id?: string
          identities_observadas?: Json
          injected_at?: string | null
          last_transcription_attempt_at?: string | null
          last_transcription_error?: Json | null
          metadata?: Json
          mp4_size_bytes?: number | null
          planos_gerados_count?: number
          public_url?: string | null
          receita_status?: string
          reuniao_id?: string
          speaker_names?: Json
          started_at?: string | null
          status?: string
          storage_path?: string | null
          transcription_attempts?: number
          transcription_progress?: number | null
          transcription_segments?: Json | null
          transcription_stage?: string | null
          transcription_status?: string
          transcription_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reuniao_gravacoes_reuniao_id_fkey"
            columns: ["reuniao_id"]
            isOneToOne: false
            referencedRelation: "reunioes"
            referencedColumns: ["id"]
          },
        ]
      }
      reunioes: {
        Row: {
          convidados: Json
          created_at: string
          created_by: string | null
          data_agendada: string | null
          data_encerramento: string | null
          data_realizada: string | null
          descricao: string | null
          host_user_id: string | null
          id: string
          lead_id: string | null
          metadata: Json
          renovacao_id: string | null
          responsavel_id: string | null
          reuniao_livekit_room: string
          sala_aberta: boolean
          status: string
          titulo: string
          updated_at: string
          vinculo_tipo: string
        }
        Insert: {
          convidados?: Json
          created_at?: string
          created_by?: string | null
          data_agendada?: string | null
          data_encerramento?: string | null
          data_realizada?: string | null
          descricao?: string | null
          host_user_id?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json
          renovacao_id?: string | null
          responsavel_id?: string | null
          reuniao_livekit_room?: string
          sala_aberta?: boolean
          status?: string
          titulo: string
          updated_at?: string
          vinculo_tipo: string
        }
        Update: {
          convidados?: Json
          created_at?: string
          created_by?: string | null
          data_agendada?: string | null
          data_encerramento?: string | null
          data_realizada?: string | null
          descricao?: string | null
          host_user_id?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json
          renovacao_id?: string | null
          responsavel_id?: string | null
          reuniao_livekit_room?: string
          sala_aberta?: boolean
          status?: string
          titulo?: string
          updated_at?: string
          vinculo_tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "reunioes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "reunioes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reunioes_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "reunioes_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reunioes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reunioes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reunioes_renovacao_id_fkey"
            columns: ["renovacao_id"]
            isOneToOne: false
            referencedRelation: "renovacoes_2026"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reunioes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "reunioes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rita_documents: {
        Row: {
          created_at: string
          criado_por: string
          erro: string | null
          flow_run_id: string | null
          id: string
          lead_id: string
          parametros: Json | null
          public_url: string | null
          status: string
          storage_path: string | null
          tipo: string
          zapi_message_id: string | null
        }
        Insert: {
          created_at?: string
          criado_por?: string
          erro?: string | null
          flow_run_id?: string | null
          id?: string
          lead_id: string
          parametros?: Json | null
          public_url?: string | null
          status?: string
          storage_path?: string | null
          tipo: string
          zapi_message_id?: string | null
        }
        Update: {
          created_at?: string
          criado_por?: string
          erro?: string | null
          flow_run_id?: string | null
          id?: string
          lead_id?: string
          parametros?: Json | null
          public_url?: string | null
          status?: string
          storage_path?: string | null
          tipo?: string
          zapi_message_id?: string | null
        }
        Relationships: []
      }
      rita_learnings: {
        Row: {
          ativa: boolean
          categoria: string
          created_at: string
          criada_por: string | null
          id: string
          instrucao: string
          prioridade: number
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          categoria?: string
          created_at?: string
          criada_por?: string | null
          id?: string
          instrucao: string
          prioridade?: number
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          categoria?: string
          created_at?: string
          criada_por?: string | null
          id?: string
          instrucao?: string
          prioridade?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rita_learnings_criada_por_fkey"
            columns: ["criada_por"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "rita_learnings_criada_por_fkey"
            columns: ["criada_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rita_post_meeting_decisions: {
        Row: {
          acao_args: Json | null
          acao_resultado: Json | null
          acao_tool: string | null
          created_at: string
          decisao: string
          gravacao_id: string | null
          id: string
          lead_id: string | null
          resumo: string | null
          reuniao_id: string | null
        }
        Insert: {
          acao_args?: Json | null
          acao_resultado?: Json | null
          acao_tool?: string | null
          created_at?: string
          decisao: string
          gravacao_id?: string | null
          id?: string
          lead_id?: string | null
          resumo?: string | null
          reuniao_id?: string | null
        }
        Update: {
          acao_args?: Json | null
          acao_resultado?: Json | null
          acao_tool?: string | null
          created_at?: string
          decisao?: string
          gravacao_id?: string | null
          id?: string
          lead_id?: string | null
          resumo?: string | null
          reuniao_id?: string | null
        }
        Relationships: []
      }
      rita_settings: {
        Row: {
          consentimento_lgpd: string
          horario_fim: string
          horario_inicio: string
          id: number
          intervalo_minimo_segundos: number
          max_mensagens_por_hora: number
          modelo_llm: string
          modelo_llm_premium: string
          responder_24_7: boolean
          rita_ativa: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          consentimento_lgpd?: string
          horario_fim?: string
          horario_inicio?: string
          id?: number
          intervalo_minimo_segundos?: number
          max_mensagens_por_hora?: number
          modelo_llm?: string
          modelo_llm_premium?: string
          responder_24_7?: boolean
          rita_ativa?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          consentimento_lgpd?: string
          horario_fim?: string
          horario_inicio?: string
          id?: number
          intervalo_minimo_segundos?: number
          max_mensagens_por_hora?: number
          modelo_llm?: string
          modelo_llm_premium?: string
          responder_24_7?: boolean
          rita_ativa?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rita_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "rita_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_comments: {
        Row: {
          content: string
          created_at: string | null
          created_by: string
          id: string
          mentioned_user_ids: string[] | null
          suggestion_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by: string
          id?: string
          mentioned_user_ids?: string[] | null
          suggestion_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string
          id?: string
          mentioned_user_ids?: string[] | null
          suggestion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_comments_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "user_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      system_roles_config: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          label: string
          sort_order: number | null
          updated_at: string | null
          value: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          label: string
          sort_order?: number | null
          updated_at?: string | null
          value: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          label?: string
          sort_order?: number | null
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      system_update_views: {
        Row: {
          id: string
          update_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          update_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          update_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_update_views_update_id_fkey"
            columns: ["update_id"]
            isOneToOne: false
            referencedRelation: "system_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      system_updates: {
        Row: {
          category: string
          created_at: string
          created_by: string
          description: string
          id: string
          is_draft: boolean
          is_highlight: boolean
          published_at: string
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by: string
          description: string
          id?: string
          is_draft?: boolean
          is_highlight?: boolean
          published_at?: string
          title: string
          updated_at?: string
          version: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          is_draft?: boolean
          is_highlight?: boolean
          published_at?: string
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      task_checklist_items: {
        Row: {
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string
          id: string
          sort_order: number
          task_id: string
          text: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by: string
          id?: string
          sort_order?: number
          task_id: string
          text: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string
          id?: string
          sort_order?: number
          task_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklist_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_history: {
        Row: {
          action: string
          created_at: string | null
          details: string | null
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: string | null
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: string | null
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string
          calendar_event_id: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          metadata: Json
          priority: string
          status: string
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          assigned_to: string
          calendar_event_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json
          priority?: string
          status?: string
          title: string
          type?: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string
          calendar_event_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json
          priority?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      triagem_franqueado: {
        Row: {
          cidade: string | null
          classificacao: string
          converted_at: string | null
          converted_by: string | null
          created_at: string
          diagnostico: string | null
          estado: string | null
          id: string
          ip_address: string | null
          lead_id: string | null
          nome: string
          perfil: string | null
          pontos_fortes: Json
          pontos_risco: Json
          recomendacao: string | null
          respostas_json: Json
          reviewed_at: string | null
          reviewed_by: string | null
          score: number
          status: string
          telefone: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          cidade?: string | null
          classificacao?: string
          converted_at?: string | null
          converted_by?: string | null
          created_at?: string
          diagnostico?: string | null
          estado?: string | null
          id?: string
          ip_address?: string | null
          lead_id?: string | null
          nome: string
          perfil?: string | null
          pontos_fortes?: Json
          pontos_risco?: Json
          recomendacao?: string | null
          respostas_json?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number
          status?: string
          telefone: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          cidade?: string | null
          classificacao?: string
          converted_at?: string | null
          converted_by?: string | null
          created_at?: string
          diagnostico?: string | null
          estado?: string | null
          id?: string
          ip_address?: string | null
          lead_id?: string | null
          nome?: string
          perfil?: string | null
          pontos_fortes?: Json
          pontos_risco?: Json
          recomendacao?: string | null
          respostas_json?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number
          status?: string
          telefone?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "triagem_franqueado_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "triagem_franqueado_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          performed_by: string | null
          unit_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          performed_by?: string | null
          unit_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          performed_by?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_audit_logs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_audit_logs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_audit_logs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_units_without_principal"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_phases: {
        Row: {
          category: string
          color: string | null
          country: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          category: string
          color?: string | null
          country?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          category?: string
          color?: string | null
          country?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      unit_states: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: string
          previous_state: string | null
          reason: string | null
          state: string
          unit_id: string
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          previous_state?: string | null
          reason?: string | null
          state: string
          unit_id: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          previous_state?: string | null
          reason?: string | null
          state?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_states_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_states_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_states_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_units_without_principal"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_sync_jobs: {
        Row: {
          attempts: number
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          mode: string
          report: Json | null
          requested_by: string | null
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          report?: Json | null
          requested_by?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          report?: Json | null
          requested_by?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      unit_sync_log: {
        Row: {
          error_message: string | null
          id: string
          payload: Json | null
          source_system: string
          status: string
          sync_type: string
          synced_at: string
          unit_code: string
        }
        Insert: {
          error_message?: string | null
          id?: string
          payload?: Json | null
          source_system: string
          status?: string
          sync_type: string
          synced_at?: string
          unit_code: string
        }
        Update: {
          error_message?: string | null
          id?: string
          payload?: Json | null
          source_system?: string
          status?: string
          sync_type?: string
          synced_at?: string
          unit_code?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          additional_info: Json
          address: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_street: string | null
          auto_terminate_on_contract_end: boolean | null
          bearer_encrypted: string | null
          business_hours: Json | null
          cep: string | null
          city: string | null
          cnpj: string | null
          code: string
          codigo_grupo: string | null
          contract_duration_months: number | null
          contract_end_date: string | null
          contract_renewal_notification_days: number | null
          contract_start_date: string | null
          contract_type: string
          contrato: string | null
          country: string
          created_at: string | null
          current_phase_id: string | null
          email: string | null
          etapa_loja: string | null
          fantasy_name: string | null
          fase_loja: string | null
          grupo: string | null
          has_parking: boolean
          has_partner_parking: boolean
          hiring_info: string | null
          id: string
          id_agente_ia: string | null
          id_page_notion: string | null
          id_pasta_unidade: string | null
          instagram: string | null
          is_active: boolean
          is_hiring: boolean
          is_opened: boolean
          link_pasta_unidade: string | null
          name: string
          opening_date: string | null
          opening_date_confirmed: boolean | null
          operational_notes: string | null
          operational_status: string | null
          organization_id: string | null
          parking_spots: number
          partner_parking_address: string | null
          payment_installments: number
          payment_methods: Json
          phone: string | null
          purchase_date: string | null
          purchase_date_confirmed: boolean | null
          purchases_active: boolean
          reference_point: string | null
          relevant_dates: Json | null
          sales_active: boolean
          state: string | null
          status: string
          store_policies: string | null
          timezone: string
          unit_model: string | null
          updated_at: string | null
        }
        Insert: {
          additional_info?: Json
          address?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_street?: string | null
          auto_terminate_on_contract_end?: boolean | null
          bearer_encrypted?: string | null
          business_hours?: Json | null
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          code: string
          codigo_grupo?: string | null
          contract_duration_months?: number | null
          contract_end_date?: string | null
          contract_renewal_notification_days?: number | null
          contract_start_date?: string | null
          contract_type?: string
          contrato?: string | null
          country?: string
          created_at?: string | null
          current_phase_id?: string | null
          email?: string | null
          etapa_loja?: string | null
          fantasy_name?: string | null
          fase_loja?: string | null
          grupo?: string | null
          has_parking?: boolean
          has_partner_parking?: boolean
          hiring_info?: string | null
          id?: string
          id_agente_ia?: string | null
          id_page_notion?: string | null
          id_pasta_unidade?: string | null
          instagram?: string | null
          is_active?: boolean
          is_hiring?: boolean
          is_opened?: boolean
          link_pasta_unidade?: string | null
          name: string
          opening_date?: string | null
          opening_date_confirmed?: boolean | null
          operational_notes?: string | null
          operational_status?: string | null
          organization_id?: string | null
          parking_spots?: number
          partner_parking_address?: string | null
          payment_installments?: number
          payment_methods?: Json
          phone?: string | null
          purchase_date?: string | null
          purchase_date_confirmed?: boolean | null
          purchases_active?: boolean
          reference_point?: string | null
          relevant_dates?: Json | null
          sales_active?: boolean
          state?: string | null
          status?: string
          store_policies?: string | null
          timezone?: string
          unit_model?: string | null
          updated_at?: string | null
        }
        Update: {
          additional_info?: Json
          address?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_street?: string | null
          auto_terminate_on_contract_end?: boolean | null
          bearer_encrypted?: string | null
          business_hours?: Json | null
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          code?: string
          codigo_grupo?: string | null
          contract_duration_months?: number | null
          contract_end_date?: string | null
          contract_renewal_notification_days?: number | null
          contract_start_date?: string | null
          contract_type?: string
          contrato?: string | null
          country?: string
          created_at?: string | null
          current_phase_id?: string | null
          email?: string | null
          etapa_loja?: string | null
          fantasy_name?: string | null
          fase_loja?: string | null
          grupo?: string | null
          has_parking?: boolean
          has_partner_parking?: boolean
          hiring_info?: string | null
          id?: string
          id_agente_ia?: string | null
          id_page_notion?: string | null
          id_pasta_unidade?: string | null
          instagram?: string | null
          is_active?: boolean
          is_hiring?: boolean
          is_opened?: boolean
          link_pasta_unidade?: string | null
          name?: string
          opening_date?: string | null
          opening_date_confirmed?: boolean | null
          operational_notes?: string | null
          operational_status?: string | null
          organization_id?: string | null
          parking_spots?: number
          partner_parking_address?: string | null
          payment_installments?: number
          payment_methods?: Json
          phone?: string | null
          purchase_date?: string | null
          purchase_date_confirmed?: boolean | null
          purchases_active?: boolean
          reference_point?: string | null
          relevant_dates?: Json | null
          sales_active?: boolean
          state?: string | null
          status?: string
          store_policies?: string | null
          timezone?: string
          unit_model?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_current_phase_fk"
            columns: ["current_phase_id"]
            isOneToOne: false
            referencedRelation: "unit_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_scores: {
        Row: {
          created_at: string | null
          id: string
          month_year: string
          points_deducted: number
          points_earned: number
          tasks_completed: number
          tasks_late: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          month_year: string
          points_deducted?: number
          points_earned?: number
          tasks_completed?: number
          tasks_late?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          month_year?: string
          points_deducted?: number
          points_earned?: number
          tasks_completed?: number
          tasks_late?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_suggestions: {
        Row: {
          admin_note: string | null
          attachments: Json
          created_at: string | null
          created_by: string
          description: string
          id: string
          image_url: string | null
          status: string
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          admin_note?: string | null
          attachments?: Json
          created_at?: string | null
          created_by: string
          description: string
          id?: string
          image_url?: string | null
          status?: string
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          admin_note?: string | null
          attachments?: Json
          created_at?: string | null
          created_by?: string
          description?: string
          id?: string
          image_url?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_unit_links: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          linked_at: string | null
          linked_by: string | null
          role_in_unit: string | null
          unit_id: string
          unlink_reason: string | null
          unlinked_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          linked_at?: string | null
          linked_by?: string | null
          role_in_unit?: string | null
          unit_id: string
          unlink_reason?: string | null
          unlinked_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          linked_at?: string | null
          linked_by?: string | null
          role_in_unit?: string | null
          unit_id?: string
          unlink_reason?: string | null
          unlinked_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_unit_links_unit_fk"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_unit_links_unit_fk"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_unit_links_unit_fk"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_units_without_principal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_unit_links_user_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "user_unit_links_user_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          equipe: string | null
          funcao: string
          id: string
          kanban_custom_labels: Json | null
          kanban_custom_stages: string[] | null
          kanban_stage_order: string[] | null
          name: string
          nivel: string
          phone: string | null
          role: string
          status: string
          theme_preference: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          equipe?: string | null
          funcao?: string
          id: string
          kanban_custom_labels?: Json | null
          kanban_custom_stages?: string[] | null
          kanban_stage_order?: string[] | null
          name: string
          nivel?: string
          phone?: string | null
          role: string
          status?: string
          theme_preference?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          equipe?: string | null
          funcao?: string
          id?: string
          kanban_custom_labels?: Json | null
          kanban_custom_stages?: string[] | null
          kanban_stage_order?: string[] | null
          name?: string
          nivel?: string
          phone?: string | null
          role?: string
          status?: string
          theme_preference?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          created_at: string
          direction: string
          from: string
          id: string
          lead_id: string | null
          message: string
          timestamp: string
          to: string
        }
        Insert: {
          created_at?: string
          direction: string
          from: string
          id?: string
          lead_id?: string | null
          message: string
          timestamp?: string
          to: string
        }
        Update: {
          created_at?: string
          direction?: string
          from?: string
          id?: string
          lead_id?: string | null
          message?: string
          timestamp?: string
          to?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      zapi_instance_logs: {
        Row: {
          created_at: string
          id: string
          instance_id: string
          mensagem: string | null
          metadata: Json
          tipo: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_id: string
          mensagem?: string | null
          metadata?: Json
          tipo: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_id?: string
          mensagem?: string | null
          metadata?: Json
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "zapi_instance_logs_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "zapi_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      zapi_instances: {
        Row: {
          ativo: boolean
          bateria: number | null
          client_token: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          instance_id: string | null
          limite_mensagens_dia: number
          mensagens_enviadas_hoje: number
          mensagens_enviadas_total: number
          nome: string
          papel: Database["public"]["Enums"]["zapi_papel"]
          phone_conectado: string | null
          prioridade: number
          status: Database["public"]["Enums"]["zapi_status"]
          token: string | null
          ultima_verificacao_em: string | null
          ultimo_erro: string | null
          ultimo_qr_code: string | null
          updated_at: string
          versao_whatsapp: string | null
        }
        Insert: {
          ativo?: boolean
          bateria?: number | null
          client_token?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          instance_id?: string | null
          limite_mensagens_dia?: number
          mensagens_enviadas_hoje?: number
          mensagens_enviadas_total?: number
          nome: string
          papel?: Database["public"]["Enums"]["zapi_papel"]
          phone_conectado?: string | null
          prioridade?: number
          status?: Database["public"]["Enums"]["zapi_status"]
          token?: string | null
          ultima_verificacao_em?: string | null
          ultimo_erro?: string | null
          ultimo_qr_code?: string | null
          updated_at?: string
          versao_whatsapp?: string | null
        }
        Update: {
          ativo?: boolean
          bateria?: number | null
          client_token?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          instance_id?: string | null
          limite_mensagens_dia?: number
          mensagens_enviadas_hoje?: number
          mensagens_enviadas_total?: number
          nome?: string
          papel?: Database["public"]["Enums"]["zapi_papel"]
          phone_conectado?: string | null
          prioridade?: number
          status?: Database["public"]["Enums"]["zapi_status"]
          token?: string | null
          ultima_verificacao_em?: string | null
          ultimo_erro?: string | null
          ultimo_qr_code?: string | null
          updated_at?: string
          versao_whatsapp?: string | null
        }
        Relationships: []
      }
      zoom_oauth_tokens: {
        Row: {
          access_token: string
          connected_at: string | null
          connected_by: string
          connected_email: string | null
          expires_at: string
          id: string
          refresh_token: string | null
          scope: string | null
          updated_at: string | null
        }
        Insert: {
          access_token: string
          connected_at?: string | null
          connected_by: string
          connected_email?: string | null
          expires_at: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          connected_at?: string | null
          connected_by?: string
          connected_email?: string | null
          expires_at?: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      leads_safe: {
        Row: {
          "1º_follow_up": string | null
          "2º_follow_up": string | null
          "3º_follow_up": string | null
          assigned_to: string | null
          board_id: string | null
          cidade_natal: string | null
          city: string | null
          city_of_interest: string | null
          commercial_responsible_id: string | null
          como_conheceu_detalhes: string | null
          como_conheceu_franquia: string | null
          contact_source: string | null
          contract_signature_date: string | null
          country_of_interest: string | null
          cpf: string | null
          created_at: string | null
          data_reunião: string | null
          date_of_birth: string | null
          disponibilidade_dedicacao: string | null
          email: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_complemento: string | null
          endereco_estado: string | null
          endereco_logradouro: string | null
          endereco_numero: string | null
          endereco_uf: string | null
          escolaridade: string | null
          faixa_salarial_anterior: string | null
          foi_indicado: boolean | null
          franchise_fee_payment_date: string | null
          franqueado_id: string | null
          franqueado_unidade_link_error: string | null
          franqueado_unidade_linked: boolean | null
          hora_mensagem: string | null
          id: string | null
          indicado_por: string | null
          instagram_pessoal: string | null
          interest: string | null
          investment: string | null
          ja_foi_empreendedor: boolean | null
          last_contact: string | null
          last_franqueado_unidade_link_attempt: string | null
          last_sync_attempt: string | null
          last_unidades_sync_attempt: string | null
          link_zoom: string | null
          lost_reason: string | null
          modelo_loja: string | null
          name: string | null
          nationality: string | null
          next_contact: string | null
          nome_unidade: string | null
          num_whatsapp_lead: string | null
          numero_habitantes: string | null
          operator_name: string | null
          phone: string | null
          possui_outras_atividades: boolean | null
          preferred_language: string | null
          profissao_anterior: string | null
          recebe_pro_labore: boolean | null
          reu_horario_exato: string | null
          sdr_responsible_id: string | null
          source: string | null
          stage: string | null
          state: string | null
          sync_error: string | null
          synced_to_franqueados: boolean | null
          synced_to_unidades: boolean | null
          tags: string[] | null
          termo_sigilo_sent: boolean | null
          thread_id: string | null
          timeout: string | null
          tipo_proprietario: string | null
          unidade_id: string | null
          unidades_sync_error: string | null
          updated_at: string | null
        }
        Insert: {
          "1º_follow_up"?: string | null
          "2º_follow_up"?: string | null
          "3º_follow_up"?: string | null
          assigned_to?: string | null
          board_id?: string | null
          cidade_natal?: string | null
          city?: string | null
          city_of_interest?: string | null
          commercial_responsible_id?: string | null
          como_conheceu_detalhes?: string | null
          como_conheceu_franquia?: string | null
          contact_source?: string | null
          contract_signature_date?: string | null
          country_of_interest?: string | null
          cpf?: string | null
          created_at?: string | null
          data_reunião?: string | null
          date_of_birth?: string | null
          disponibilidade_dedicacao?: string | null
          email?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          endereco_uf?: string | null
          escolaridade?: string | null
          faixa_salarial_anterior?: string | null
          foi_indicado?: boolean | null
          franchise_fee_payment_date?: string | null
          franqueado_id?: string | null
          franqueado_unidade_link_error?: string | null
          franqueado_unidade_linked?: boolean | null
          hora_mensagem?: string | null
          id?: string | null
          indicado_por?: string | null
          instagram_pessoal?: string | null
          interest?: string | null
          investment?: string | null
          ja_foi_empreendedor?: boolean | null
          last_contact?: string | null
          last_franqueado_unidade_link_attempt?: string | null
          last_sync_attempt?: string | null
          last_unidades_sync_attempt?: string | null
          link_zoom?: string | null
          lost_reason?: string | null
          modelo_loja?: string | null
          name?: string | null
          nationality?: string | null
          next_contact?: string | null
          nome_unidade?: string | null
          num_whatsapp_lead?: string | null
          numero_habitantes?: string | null
          operator_name?: string | null
          phone?: string | null
          possui_outras_atividades?: boolean | null
          preferred_language?: string | null
          profissao_anterior?: string | null
          recebe_pro_labore?: boolean | null
          reu_horario_exato?: string | null
          sdr_responsible_id?: string | null
          source?: string | null
          stage?: string | null
          state?: string | null
          sync_error?: string | null
          synced_to_franqueados?: boolean | null
          synced_to_unidades?: boolean | null
          tags?: string[] | null
          termo_sigilo_sent?: boolean | null
          thread_id?: string | null
          timeout?: string | null
          tipo_proprietario?: string | null
          unidade_id?: string | null
          unidades_sync_error?: string | null
          updated_at?: string | null
        }
        Update: {
          "1º_follow_up"?: string | null
          "2º_follow_up"?: string | null
          "3º_follow_up"?: string | null
          assigned_to?: string | null
          board_id?: string | null
          cidade_natal?: string | null
          city?: string | null
          city_of_interest?: string | null
          commercial_responsible_id?: string | null
          como_conheceu_detalhes?: string | null
          como_conheceu_franquia?: string | null
          contact_source?: string | null
          contract_signature_date?: string | null
          country_of_interest?: string | null
          cpf?: string | null
          created_at?: string | null
          data_reunião?: string | null
          date_of_birth?: string | null
          disponibilidade_dedicacao?: string | null
          email?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          endereco_uf?: string | null
          escolaridade?: string | null
          faixa_salarial_anterior?: string | null
          foi_indicado?: boolean | null
          franchise_fee_payment_date?: string | null
          franqueado_id?: string | null
          franqueado_unidade_link_error?: string | null
          franqueado_unidade_linked?: boolean | null
          hora_mensagem?: string | null
          id?: string | null
          indicado_por?: string | null
          instagram_pessoal?: string | null
          interest?: string | null
          investment?: string | null
          ja_foi_empreendedor?: boolean | null
          last_contact?: string | null
          last_franqueado_unidade_link_attempt?: string | null
          last_sync_attempt?: string | null
          last_unidades_sync_attempt?: string | null
          link_zoom?: string | null
          lost_reason?: string | null
          modelo_loja?: string | null
          name?: string | null
          nationality?: string | null
          next_contact?: string | null
          nome_unidade?: string | null
          num_whatsapp_lead?: string | null
          numero_habitantes?: string | null
          operator_name?: string | null
          phone?: string | null
          possui_outras_atividades?: boolean | null
          preferred_language?: string | null
          profissao_anterior?: string | null
          recebe_pro_labore?: boolean | null
          reu_horario_exato?: string | null
          sdr_responsible_id?: string | null
          source?: string | null
          stage?: string | null
          state?: string | null
          sync_error?: string | null
          synced_to_franqueados?: boolean | null
          synced_to_unidades?: boolean | null
          tags?: string[] | null
          termo_sigilo_sent?: boolean | null
          thread_id?: string | null
          timeout?: string | null
          tipo_proprietario?: string | null
          unidade_id?: string | null
          unidades_sync_error?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "kanban_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      reuniao_gravacoes_overview: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          egress_id: string | null
          ended_at: string | null
          error_message: string | null
          host_user_id: string | null
          id: string | null
          injected_at: string | null
          last_transcription_attempt_at: string | null
          last_transcription_error: Json | null
          lead_id: string | null
          lead_name: string | null
          metadata: Json | null
          mp4_size_bytes: number | null
          public_url: string | null
          renovacao_id: string | null
          renovacao_unidade: string | null
          responsavel_id: string | null
          reuniao_created_by: string | null
          reuniao_id: string | null
          reuniao_titulo: string | null
          speaker_names: Json | null
          started_at: string | null
          status: string | null
          storage_path: string | null
          transcription_attempts: number | null
          transcription_progress: number | null
          transcription_segments: Json | null
          transcription_stage: string | null
          transcription_status: string | null
          transcription_text: string | null
          updated_at: string | null
          vinculo_tipo: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reuniao_gravacoes_reuniao_id_fkey"
            columns: ["reuniao_id"]
            isOneToOne: false
            referencedRelation: "reunioes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reunioes_created_by_fkey"
            columns: ["reuniao_created_by"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "reunioes_created_by_fkey"
            columns: ["reuniao_created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reunioes_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "reunioes_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reunioes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reunioes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reunioes_renovacao_id_fkey"
            columns: ["renovacao_id"]
            isOneToOne: false
            referencedRelation: "renovacoes_2026"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reunioes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "unit_details_view"
            referencedColumns: ["franqueado_principal_id"]
          },
          {
            foreignKeyName: "reunioes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_details_view: {
        Row: {
          additional_info: Json | null
          address: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_street: string | null
          auto_terminate_on_contract_end: boolean | null
          bearer_present: boolean | null
          business_hours: Json | null
          cep: string | null
          city: string | null
          cnpj: string | null
          code: string | null
          codigo_grupo: string | null
          colaboradores_ativos_count: number | null
          contract_duration_months: number | null
          contract_end_date: string | null
          contract_renewal_notification_days: number | null
          contract_start_date: string | null
          contract_type: string | null
          contrato: string | null
          country: string | null
          created_at: string | null
          current_phase_id: string | null
          days_to_contract_end: number | null
          email: string | null
          etapa_loja: string | null
          fantasy_name: string | null
          fase_loja: string | null
          franqueado_principal_email: string | null
          franqueado_principal_id: string | null
          franqueado_principal_name: string | null
          grupo: string | null
          has_parking: boolean | null
          has_partner_parking: boolean | null
          hiring_info: string | null
          id: string | null
          id_agente_ia: string | null
          id_page_notion: string | null
          id_pasta_unidade: string | null
          instagram: string | null
          is_active: boolean | null
          is_hiring: boolean | null
          is_opened: boolean | null
          link_pasta_unidade: string | null
          name: string | null
          opening_date: string | null
          opening_date_confirmed: boolean | null
          operational_notes: string | null
          operational_status: string | null
          parking_spots: number | null
          partner_parking_address: string | null
          payment_installments: number | null
          payment_methods: Json | null
          phase_category: string | null
          phase_name: string | null
          phase_slug: string | null
          phone: string | null
          purchase_date: string | null
          purchase_date_confirmed: boolean | null
          purchases_active: boolean | null
          reference_point: string | null
          relevant_dates: Json | null
          sales_active: boolean | null
          state: string | null
          status: string | null
          store_policies: string | null
          timezone: string | null
          unit_model: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_current_phase_fk"
            columns: ["current_phase_id"]
            isOneToOne: false
            referencedRelation: "unit_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      v_unit_sync_status: {
        Row: {
          has_conflict: boolean | null
          last_sync_external: string | null
          last_sync_sistema_a: string | null
          last_sync_sistema_b: string | null
          last_updated: string | null
          unit_code: string | null
        }
        Relationships: []
      }
      v_units_without_principal: {
        Row: {
          additional_info: Json | null
          address: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_street: string | null
          auto_terminate_on_contract_end: boolean | null
          bearer_encrypted: string | null
          business_hours: Json | null
          cep: string | null
          city: string | null
          cnpj: string | null
          code: string | null
          codigo_grupo: string | null
          contract_duration_months: number | null
          contract_end_date: string | null
          contract_renewal_notification_days: number | null
          contract_start_date: string | null
          contract_type: string | null
          contrato: string | null
          country: string | null
          created_at: string | null
          current_phase_id: string | null
          email: string | null
          etapa_loja: string | null
          fantasy_name: string | null
          fase_loja: string | null
          grupo: string | null
          has_parking: boolean | null
          has_partner_parking: boolean | null
          hiring_info: string | null
          id: string | null
          id_agente_ia: string | null
          id_page_notion: string | null
          id_pasta_unidade: string | null
          instagram: string | null
          is_active: boolean | null
          is_hiring: boolean | null
          is_opened: boolean | null
          link_pasta_unidade: string | null
          name: string | null
          opening_date: string | null
          opening_date_confirmed: boolean | null
          operational_notes: string | null
          operational_status: string | null
          organization_id: string | null
          parking_spots: number | null
          partner_parking_address: string | null
          payment_installments: number | null
          payment_methods: Json | null
          phone: string | null
          purchase_date: string | null
          purchase_date_confirmed: boolean | null
          purchases_active: boolean | null
          reference_point: string | null
          relevant_dates: Json | null
          sales_active: boolean | null
          state: string | null
          status: string | null
          store_policies: string | null
          timezone: string | null
          unit_model: string | null
          updated_at: string | null
        }
        Insert: {
          additional_info?: Json | null
          address?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_street?: string | null
          auto_terminate_on_contract_end?: boolean | null
          bearer_encrypted?: string | null
          business_hours?: Json | null
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          code?: string | null
          codigo_grupo?: string | null
          contract_duration_months?: number | null
          contract_end_date?: string | null
          contract_renewal_notification_days?: number | null
          contract_start_date?: string | null
          contract_type?: string | null
          contrato?: string | null
          country?: string | null
          created_at?: string | null
          current_phase_id?: string | null
          email?: string | null
          etapa_loja?: string | null
          fantasy_name?: string | null
          fase_loja?: string | null
          grupo?: string | null
          has_parking?: boolean | null
          has_partner_parking?: boolean | null
          hiring_info?: string | null
          id?: string | null
          id_agente_ia?: string | null
          id_page_notion?: string | null
          id_pasta_unidade?: string | null
          instagram?: string | null
          is_active?: boolean | null
          is_hiring?: boolean | null
          is_opened?: boolean | null
          link_pasta_unidade?: string | null
          name?: string | null
          opening_date?: string | null
          opening_date_confirmed?: boolean | null
          operational_notes?: string | null
          operational_status?: string | null
          organization_id?: string | null
          parking_spots?: number | null
          partner_parking_address?: string | null
          payment_installments?: number | null
          payment_methods?: Json | null
          phone?: string | null
          purchase_date?: string | null
          purchase_date_confirmed?: boolean | null
          purchases_active?: boolean | null
          reference_point?: string | null
          relevant_dates?: Json | null
          sales_active?: boolean | null
          state?: string | null
          status?: string | null
          store_policies?: string | null
          timezone?: string | null
          unit_model?: string | null
          updated_at?: string | null
        }
        Update: {
          additional_info?: Json | null
          address?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_street?: string | null
          auto_terminate_on_contract_end?: boolean | null
          bearer_encrypted?: string | null
          business_hours?: Json | null
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          code?: string | null
          codigo_grupo?: string | null
          contract_duration_months?: number | null
          contract_end_date?: string | null
          contract_renewal_notification_days?: number | null
          contract_start_date?: string | null
          contract_type?: string | null
          contrato?: string | null
          country?: string | null
          created_at?: string | null
          current_phase_id?: string | null
          email?: string | null
          etapa_loja?: string | null
          fantasy_name?: string | null
          fase_loja?: string | null
          grupo?: string | null
          has_parking?: boolean | null
          has_partner_parking?: boolean | null
          hiring_info?: string | null
          id?: string | null
          id_agente_ia?: string | null
          id_page_notion?: string | null
          id_pasta_unidade?: string | null
          instagram?: string | null
          is_active?: boolean | null
          is_hiring?: boolean | null
          is_opened?: boolean | null
          link_pasta_unidade?: string | null
          name?: string | null
          opening_date?: string | null
          opening_date_confirmed?: boolean | null
          operational_notes?: string | null
          operational_status?: string | null
          organization_id?: string | null
          parking_spots?: number | null
          partner_parking_address?: string | null
          payment_installments?: number | null
          payment_methods?: Json | null
          phone?: string | null
          purchase_date?: string | null
          purchase_date_confirmed?: boolean | null
          purchases_active?: boolean | null
          reference_point?: string | null
          relevant_dates?: Json | null
          sales_active?: boolean | null
          state?: string | null
          status?: string | null
          store_policies?: string | null
          timezone?: string | null
          unit_model?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_current_phase_fk"
            columns: ["current_phase_id"]
            isOneToOne: false
            referencedRelation: "unit_phases"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      acknowledge_broadcast: { Args: { _conv: string }; Returns: undefined }
      check_email_approval: { Args: { check_email: string }; Returns: Json }
      cleanup_expired_emails: { Args: never; Returns: undefined }
      create_notification: {
        Args: {
          p_message: string
          p_metadata?: Json
          p_source_id?: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      find_or_create_dm: { Args: { _other: string }; Returns: string }
      fn_auto_encerrar_reunioes_zumbis: {
        Args: never
        Returns: {
          motivo: string
          reuniao_id: string
        }[]
      }
      fn_enqueue_lead_score_recalc: {
        Args: { _lead_id: string; _reason: string }
        Returns: undefined
      }
      fn_gerar_room_slug: { Args: never; Returns: string }
      fn_parse_termino_to_date: { Args: { p_text: string }; Returns: string }
      has_elevated_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_chat_participant: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      is_email_approved: {
        Args: { user_email: string }
        Returns: {
          approved: boolean
          suggested_name: string
        }[]
      }
      mark_conversation_read: { Args: { _conv: string }; Returns: undefined }
      mark_email_as_used:
        | { Args: { user_email: string }; Returns: undefined }
        | { Args: { user_email: string; user_id: string }; Returns: undefined }
      notify_admins_new_suggestion: {
        Args: { p_suggestion_id: string; p_title: string; p_type: string }
        Returns: undefined
      }
      process_scheduled_campaigns: { Args: never; Returns: undefined }
      send_broadcast: {
        Args: {
          p_attachments: Json
          p_content: string
          p_subject: string
          p_user_ids: string[]
        }
        Returns: string
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      trigger_campaign_processing: {
        Args: { p_campaign_id: string }
        Returns: Json
      }
      unaccent: { Args: { "": string }; Returns: string }
      units_get_bearer: {
        Args: { _key: string; _unit_id: string }
        Returns: string
      }
      units_set_bearer: {
        Args: { _bearer: string; _key: string; _unit_id: string }
        Returns: undefined
      }
      upsert_user_score: {
        Args: {
          p_completed?: number
          p_deducted?: number
          p_earned?: number
          p_late?: number
          p_user_id: string
        }
        Returns: undefined
      }
      zapi_get_active_credentials: {
        Args: { _papel: Database["public"]["Enums"]["zapi_papel"] }
        Returns: {
          client_token: string
          id: string
          instance_id: string
          limite_mensagens_dia: number
          mensagens_enviadas_hoje: number
          nome: string
          token: string
        }[]
      }
      zapi_increment_message_count: {
        Args: { _instance_id: string }
        Returns: undefined
      }
      zapi_mark_status: {
        Args: {
          _erro?: string
          _instance_id: string
          _status: Database["public"]["Enums"]["zapi_status"]
        }
        Returns: undefined
      }
      zapi_promote_to_primary: {
        Args: { _instance_id: string }
        Returns: undefined
      }
      zapi_reset_daily_counters: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "moderator" | "agent" | "sdr"
      zapi_papel: "rita_leads" | "renovacao" | "notificacoes" | "generica"
      zapi_status:
        | "ativa"
        | "inativa"
        | "desconectada"
        | "banida"
        | "manutencao"
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
      app_role: ["admin", "moderator", "agent", "sdr"],
      zapi_papel: ["rita_leads", "renovacao", "notificacoes", "generica"],
      zapi_status: ["ativa", "inativa", "desconectada", "banida", "manutencao"],
    },
  },
} as const
