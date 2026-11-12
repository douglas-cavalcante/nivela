import type { SubjectColorKey } from "./subjects";

/** Indicadores do Início da equipe (`GET /dashboard/summary`); taxa e "precisam de ajuda" olham os últimos 30 dias. */
export interface ApiDashboardSummary {
  active_students: number;
  active_questions: number;
  /** Porcentagem inteira de acerto por questão terminada; null sem questões terminadas. */
  accuracy: number | null;
  students_needing_help: number;
  pending_redemptions: number;
}

/** Atividade de um dia de estudo (Fortaleza). */
export interface ApiActivityDay {
  /** `YYYY-MM-DD` em America/Fortaleza. */
  day: string;
  answered: number;
  correct: number;
}

export interface ApiStudentNeedingHelp {
  student: { id: number; name: string };
  accuracy: number;
  finished: number;
}

export interface ApiCategoryPerformance {
  category: { id: number; name: string };
  subject: { id: number; name: string; color: SubjectColorKey };
  finished: number;
  correct: number;
  accuracy: number | null;
}

export type CoinReason =
  | "correct_answer"
  | "plan_completed"
  | "streak_bonus"
  | "redemption"
  | "refund";

/** Linha do extrato de moedas; `amount` é negativo nos débitos. */
export interface ApiCoinTransaction {
  id: number;
  amount: number;
  reason: CoinReason;
  description: string;
  created_at: string;
}
