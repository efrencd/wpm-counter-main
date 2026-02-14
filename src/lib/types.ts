export type MembershipRole = 'owner' | 'teacher';

export interface ClassRecord {
  id: string;
  name: string;
  grade: number;
  join_code: string;
  active_text_id: string | null;
}

export interface StudentRecord {
  id: string;
  class_id: string;
  display_name: string;
  active: boolean;
  created_at: string;
}

export interface TextRecord {
  id: string;
  grade: number;
  title: string;
  content: string;
  word_count: number;
  topic?: string | null;
  difficulty_tag?: string | null;
}

export interface ReadingSessionRecord {
  id: string;
  student_id: string;
  text_id: string;
  started_at: string;
  duration_seconds: number;
  wpm: number;
  accuracy: number;
}

export interface StudentAuthResponse {
  token: string;
  student_id: string;
  class_id: string;
  grade: number;
  active_text_id?: string | null;
}
