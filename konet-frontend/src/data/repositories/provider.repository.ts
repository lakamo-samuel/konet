import { serverQuery } from "@/data/access/server";
import type { SearchCriteria } from "@/data/access/contracts";
export const getProviders = () => serverQuery("providers", {});
export const getProviderById = (id: string) => serverQuery("provider", { id });
export const searchProviders = (criteria: SearchCriteria) => serverQuery("providers", criteria);
export const getServicesByProvider = (providerId: string) => serverQuery("services", { providerId });
export const getPortfolioByProvider = (providerId: string) => serverQuery("portfolio", { providerId });
export const getReviewsByProvider = (providerId: string) => serverQuery("reviews", { providerId });
export async function getFeaturedProviders() { return (await getProviders()).filter(item => item.verification.work === "verified").slice(0, 4); }
