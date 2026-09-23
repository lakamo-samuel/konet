export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";
export type JobStatus = "requested" | "quoted" | "funded" | "in_progress" | "delivered" | "released" | "reviewed" | "disputed";
export interface University { id:string; name:string; shortName:string; city:string; state:string; campuses:string[] }
export interface User { id:string; name:string; email:string; avatar:string; universityId:string; campus:string; studentVerification:VerificationStatus; identityVerification:VerificationStatus; providerProfileId?:string }
export interface ProviderVerification { identity:VerificationStatus; work:VerificationStatus; cac?:VerificationStatus }
export interface ProviderReputation { rating:number; reviewCount:number; completedJobs:number; completionRate:number; repeatClients:number; unresolvedDisputes:number }
export interface ProviderProfile { id:string; userId:string; fullName?:string; universityId:string; campus:string; professionalTitle:string; category:string; bio:string; startingPrice:number; available:boolean; responseTime:string; verification:ProviderVerification; reputation:ProviderReputation; coverImage:string; avatar:string }
export interface Service { id:string; providerId:string; name:string; description:string; startingPrice:number; pricingUnit:string; active:boolean }
export interface PortfolioItem { id:string; providerId:string; title:string; category:string; image:string; alt:string }
export interface ServiceRequest { id:string; clientId:string; providerId:string; service:string; requestedDate:string; requestedTime:string; location:string; budgetMin:number; budgetMax:number; details:string; status:"pending"|"quoted"|"declined" }
export interface Quote { id:string; requestId:string; amount:number; scope:string[]; note:string; expiresAt:string; status:"pending"|"accepted"|"declined"|"expired" }
export interface Job { id:string; requestId:string; quoteId:string; clientId:string; providerId:string; service:string; date:string; time:string; location:string; amount:number; status:JobStatus }
export interface Conversation { id:string; jobId?:string; participantIds:string[]; updatedAt:string }
export interface Message { id:string; conversationId:string; senderId:string; body:string; createdAt:string; system?:boolean }
export interface EscrowTransaction { id:string; jobId:string; amount:number; platformFee:number; status:"unfunded"|"protected"|"released"|"disputed" }
export interface Review { id:string; jobId:string; providerId:string; authorId:string; rating:number; body:string; service:string; verifiedJob:boolean; createdAt:string }
export interface Notification { id:string; userId:string; type:"request"|"quote"|"payment"|"job"|"review"|"verification"|"dispute"; title:string; body:string; read:boolean; href:string; createdAt:string }
