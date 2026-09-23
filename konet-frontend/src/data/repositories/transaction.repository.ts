import {transactions} from "@/data/mock/jobs";
export async function getTransactionByJob(jobId:string){return transactions.find(item=>item.jobId===jobId)??null;}
