"use client";
import {useRouter} from "next/navigation";import {Button} from "@/components/ui/button";
export function OnboardingForm({step,next,children}:{step:string;next:string;children:React.ReactNode}){const router=useRouter();return <form className="surface-panel form-stack" onSubmit={e=>{e.preventDefault();router.push(next)}}><span className="eyebrow">Provider setup · {step}</span>{children}<div className="action-row"><Button type="submit">Save and continue</Button><Button type="button" variant="quiet" onClick={()=>router.back()}>Back</Button></div></form>}
