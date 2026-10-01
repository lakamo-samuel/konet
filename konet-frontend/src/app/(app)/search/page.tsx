import { redirect } from "next/navigation";
export default async function Page({searchParams}:{searchParams:Promise<{q?:string;campus?:string}>}){
  const {q, campus}=await searchParams;
  const params=new URLSearchParams();
  if(q) params.set("q",q);
  if(campus) params.set("campus",campus);
  redirect(`/discover${params.size?`?${params.toString()}`:""}`);
}
