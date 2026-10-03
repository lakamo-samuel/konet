export interface AccountProfileInput {
  fullName?: string;
  avatarUrl?: string;
  universityId?: string;
  campusId?: string;
}
export interface EmailChangeChallenge {
  challengeId: string;
  expiresAt: string;
  resendAfter: string;
}
