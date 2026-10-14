export interface AccountProfileInput {
  fullName?: string;
  avatarUrl?: string | null;
  universityId?: string;
  campusId?: string;
}
export interface AvatarUploadTicket {
  publicId: string;
  uploadUrl: string;
  method: "POST";
  fields: Record<string, string>;
  expiresAt: string;
}
export interface EmailChangeChallenge {
  challengeId: string;
  expiresAt: string;
  resendAfter: string;
}
