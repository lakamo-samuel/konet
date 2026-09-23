import type {Metadata} from "next";import Link from "next/link";import {AuthForm} from "@/features/auth/components/auth-form";
export const metadata:Metadata={title:"Sign in",description:"Sign in to your verified student network."};
export default function SignInPage(){return <div className="auth-panel"><span className="eyebrow">WELCOME BACK</span><h2>Good to have you back.</h2><p>Sign in to continue to your campus community.</p><AuthForm mode="sign-in"/><p>New to Konet? <Link href="/sign-up">Create an account</Link></p></div>}
