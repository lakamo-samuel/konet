import { DomainError } from "../../common/errors/domain.error";
export type JobState =
  | "awaiting_payment"
  | "scheduled"
  | "in_progress"
  | "awaiting_client_confirmation"
  | "completed"
  | "cancelled"
  | "disputed";
const allowed: Record<JobState, JobState[]> = {
  awaiting_payment: ["scheduled", "cancelled"],
  scheduled: ["in_progress", "cancelled", "disputed"],
  in_progress: ["awaiting_client_confirmation", "disputed"],
  awaiting_client_confirmation: ["completed", "disputed"],
  completed: [],
  cancelled: [],
  disputed: ["completed", "cancelled"],
};
export function assertJobTransition(from: JobState, to: JobState) {
  if (!allowed[from].includes(to))
    throw new DomainError(
      "INVALID_JOB_TRANSITION",
      `A job cannot move from ${from} to ${to}.`,
      409,
    );
}
