import { serverQuery } from "@/data/access/server";
export const getTransactionByJob = (jobId: string) => serverQuery("transaction", { jobId });
