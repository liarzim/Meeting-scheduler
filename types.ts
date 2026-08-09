export type MeetingStatus = 'OPEN' | 'SCHEDULED';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  phone_number: string | null;
  is_organizer: boolean;
}

export interface Meeting {
  id: string;
  organizer_id: string | null;
  title: string;
  slug: string;
  status: MeetingStatus;
}

export interface MeetingParticipant {
  id: string;
  meeting_id: string | null;
  profile_id: string | null;
  is_required: boolean;
}

export interface AvailabilitySlot {
  id: string;
  participant_id: string | null;
  slot_key?: string;
  start_time: string;
  end_time: string;
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id?: string;
          email: string;
          full_name?: string | null;
          company?: string | null;
          phone_number?: string | null;
          is_organizer?: boolean;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          company?: string | null;
          phone_number?: string | null;
          is_organizer?: boolean;
        };
        Relationships: [];
      };
      meetings: {
        Row: Meeting;
        Insert: {
          id?: string;
          organizer_id?: string | null;
          title: string;
          slug: string;
          status?: MeetingStatus;
        };
        Update: {
          id?: string;
          organizer_id?: string | null;
          title?: string;
          slug?: string;
          status?: MeetingStatus;
        };
        Relationships: [
          {
            foreignKeyName: "meetings_organizer_id_fkey";
            columns: ["organizer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      meeting_participants: {
        Row: MeetingParticipant;
        Insert: {
          id?: string;
          meeting_id?: string | null;
          profile_id?: string | null;
          is_required?: boolean;
        };
        Update: {
          id?: string;
          meeting_id?: string | null;
          profile_id?: string | null;
          is_required?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meeting_participants_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      availability_slots: {
        Row: AvailabilitySlot;
        Insert: {
          id?: string;
          participant_id?: string | null;
          slot_key?: string;
          start_time: string;
          end_time: string;
        };
        Update: {
          id?: string;
          participant_id?: string | null;
          slot_key?: string;
          start_time?: string;
          end_time?: string;
        };
        Relationships: [
          {
            foreignKeyName: "availability_slots_participant_id_fkey";
            columns: ["participant_id"];
            isOneToOne: false;
            referencedRelation: "meeting_participants";
            referencedColumns: ["id"];
          }
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
      meeting_status: MeetingStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
