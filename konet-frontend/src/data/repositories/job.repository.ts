import { serverQuery } from "@/data/access/server";
export const getJobsForUser = (userId: string) => serverQuery("jobs", { userId });
export const getJobById = (id: string) => serverQuery("job", { id });
export const getRequestById = (id: string) => serverQuery("request", { id });
export const getQuoteById = (id: string) => serverQuery("quote", { id });
export const getProviderRequests = (providerId: string) => serverQuery("requests", { providerId });
