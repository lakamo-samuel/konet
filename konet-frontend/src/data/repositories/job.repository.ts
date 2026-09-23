import {jobs,quotes,requests} from "@/data/mock/jobs";
export async function getJobsForUser(userId:string){return jobs.filter(item=>item.clientId===userId||item.providerId===userId);}
export async function getJobById(id:string){return jobs.find(item=>item.id===id)??null;}
export async function getRequestById(id:string){return requests.find(item=>item.id===id)??null;}
export async function getQuoteById(id:string){return quotes.find(item=>item.id===id)??null;}
export async function getProviderRequests(providerId:string){return requests.filter(item=>item.providerId===providerId);}
