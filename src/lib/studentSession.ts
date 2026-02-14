const KEY = 'student-session';

export interface StudentSessionState {
  token: string;
  student_id: string;
  class_id: string;
  grade: number;
}

export interface StudentReadingResult {
  wpm: number;
  accuracy: number;
  duration_seconds: number;
  invalid_short: boolean;
}

export function saveStudentSession(session: StudentSessionState) {
  sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function getStudentSession(): StudentSessionState | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StudentSessionState;
  } catch {
    return null;
  }
}

export function clearStudentSession() {
  sessionStorage.removeItem(KEY);
}

export function saveLastResult(result: StudentReadingResult) {
  sessionStorage.setItem('student-result', JSON.stringify(result));
}

export function getLastResult(): StudentReadingResult | null {
  const raw = sessionStorage.getItem('student-result');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StudentReadingResult;
  } catch {
    return null;
  }
}
