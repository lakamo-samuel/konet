import type {Metadata} from "next";import Link from "next/link";import {AuthForm} from "@/features/auth/components/auth-form";
export const metadata:Metadata={title:"Create account",description:"Join Konet with one student account for hiring and offering services."};
export default function SignUpPage(){return <div className="auth-panel"><span className="eyebrow">JOIN YOUR CAMPUS</span><h2>Your people are here.</h2><p>Create one account to discover talent and later offer your own service.</p><AuthForm mode="sign-up"/><p>Already registered? <Link href="/sign-in">Sign in</Link></p></div>}
