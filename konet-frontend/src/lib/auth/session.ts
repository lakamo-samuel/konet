import {cookies} from "next/headers";
export type Session={userId:string;isStudentVerified:boolean;providerProfileId?:string};
export async function getSession():Promise<Session|null>{const store=await cookies();const userId=store.get("konet_session")?.value;if(!userId)return null;return {userId,isStudentVerified:store.get("konet_student_verified")?.value==="true",providerProfileId:store.get("konet_provider")?.value}}
