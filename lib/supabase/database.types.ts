// Generated from the migration schema using PGlite. Regenerate from the live project with npm run types:generate after setup.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
export type Database = {
  public: {
    Tables: {
      achievements: {
        Row: { id: string; name: string; description: string };
        Insert: { id: string; name: string; description: string };
        Update: { id?: string; name?: string; description?: string };
        Relationships: [];
      };
      exercises: {
        Row: {
          id: string;
          lesson_id: string;
          type: string;
          prompt: string;
          options: Json;
          position: number;
        };
        Insert: {
          id: string;
          lesson_id: string;
          type: string;
          prompt: string;
          options?: Json;
          position: number;
        };
        Update: {
          id?: string;
          lesson_id?: string;
          type?: string;
          prompt?: string;
          options?: Json;
          position?: number;
        };
        Relationships: [];
      };
      flashcard_reviews: {
        Row: {
          user_id: string;
          card_id: string;
          interval: number;
          due: string;
          reviewed_at: string;
        };
        Insert: {
          user_id: string;
          card_id: string;
          interval?: number;
          due?: string;
          reviewed_at?: string;
        };
        Update: {
          user_id?: string;
          card_id?: string;
          interval?: number;
          due?: string;
          reviewed_at?: string;
        };
        Relationships: [];
      };
      flashcards: {
        Row: {
          id: string;
          lesson_id: string;
          word: string;
          translation: string;
          example: string;
        };
        Insert: {
          id: string;
          lesson_id: string;
          word: string;
          translation: string;
          example: string;
        };
        Update: {
          id?: string;
          lesson_id?: string;
          word?: string;
          translation?: string;
          example?: string;
        };
        Relationships: [];
      };
      game_scores: {
        Row: {
          id: string;
          user_id: string;
          kind: string;
          score: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: string;
          score: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          kind?: string;
          score?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      languages: {
        Row: { id: string; name: string };
        Insert: { id: string; name: string };
        Update: { id?: string; name?: string };
        Relationships: [];
      };
      lessons: {
        Row: {
          id: string;
          unit_id: string;
          title: string;
          words: Json;
          position: number;
        };
        Insert: {
          id: string;
          unit_id: string;
          title: string;
          words: Json;
          position: number;
        };
        Update: {
          id?: string;
          unit_id?: string;
          title?: string;
          words?: Json;
          position?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          name: string;
          language: string;
          locale: string;
          goal: number;
          level: string;
          xp: number;
          created_at: string;
        };
        Insert: {
          id: string;
          name?: string;
          language?: string;
          locale?: string;
          goal?: number;
          level?: string;
          xp?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          language?: string;
          locale?: string;
          goal?: number;
          level?: string;
          xp?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      streaks: {
        Row: { user_id: string; day: string; xp: number };
        Insert: { user_id: string; day: string; xp: number };
        Update: { user_id?: string; day?: string; xp?: number };
        Relationships: [];
      };
      units: {
        Row: {
          id: string;
          language_id: string;
          title: string;
          position: number;
        };
        Insert: {
          id: string;
          language_id: string;
          title: string;
          position: number;
        };
        Update: {
          id?: string;
          language_id?: string;
          title?: string;
          position?: number;
        };
        Relationships: [];
      };
      user_achievements: {
        Row: { user_id: string; achievement_id: string; earned_at: string };
        Insert: { user_id: string; achievement_id: string; earned_at?: string };
        Update: {
          user_id?: string;
          achievement_id?: string;
          earned_at?: string;
        };
        Relationships: [];
      };
      user_progress: {
        Row: {
          user_id: string;
          lesson_id: string;
          score: number;
          xp: number;
          completed_at: string;
        };
        Insert: {
          user_id: string;
          lesson_id: string;
          score: number;
          xp: number;
          completed_at?: string;
        };
        Update: {
          user_id?: string;
          lesson_id?: string;
          score?: number;
          xp?: number;
          completed_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      weekly_leaderboard: {
        Row: {
          id: string | null;
          display_name: string | null;
          weekly_xp: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      award_lesson: {
        Args: {
          p_user_id: string;
          p_lesson_id: string;
          p_score: number;
          p_xp: number;
        };
        Returns: Json;
      };
      review_card: {
        Args: { p_user_id: string; p_card_id: string; p_known: boolean };
        Returns: Json;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
