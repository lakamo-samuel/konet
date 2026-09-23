"use client";
import {useRouter} from "next/navigation";
import {Button} from "@/components/ui/button";
export function PublishProviderButton(){const router=useRouter();return <Button onClick={()=>{document.cookie="konet_provider=aisha; path=/; max-age=604800; samesite=lax";router.push("/provider/dashboard");router.refresh()}}>Publish verified profile</Button>}
