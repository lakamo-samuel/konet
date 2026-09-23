"use client";
import {useRouter} from "next/navigation";import {Button} from "@/components/ui/button";
export function QuoteActions({jobId}:{jobId:string}){const router=useRouter();return <div className="action-row"><Button onClick={()=>router.push(`/checkout/${jobId}`)}>Accept quote</Button><Button variant="secondary" onClick={()=>router.push("/messages/conversation-aisha")}>Ask a question</Button></div>}
