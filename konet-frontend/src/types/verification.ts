import type { VerificationStatus } from "./domain";
export type StudentVerificationMethod =
  "university_email" | "student_id" | "manual_document";
export interface VerificationMethods {
  methods: StudentVerificationMethod[];
  approvedEmailDomains: string[];
}
export interface StudentVerification {
  id: string;
  method: StudentVerificationMethod;
  status: VerificationStatus;
  universityId: string;
  campusId: string;
  submittedAt: string;
  decidedAt: string | null;
  createdAt: string;
  reason: string | null;
  uploadId: string | null;
}
export interface EmailChallenge {
  challengeId: string;
  expiresAt: string;
  resendAfter: string;
  delivery: "email";
}
export interface PrivateUpload {
  id: string;
  objectKey: string;
  purpose: "student_evidence" | "provider_evidence";
  status:
    "pending" | "scanning" | "ready" | "rejected" | "deleting" | "deleted";
  createdAt: string;
  retainUntil: string;
}
export interface UploadTicket {
  upload: PrivateUpload;
  uploadUrl: string;
  method: "POST";
  fields: Record<string, string>;
  expiresAt: string;
}
