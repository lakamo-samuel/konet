"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/data/access/client";
import { useDataCommand } from "@/lib/query/hooks";
export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" | "forgot-password" }) {
  const router = useRouter();
  const signIn = useDataCommand("signIn");
  const signUp = useDataCommand("signUp");
  const recover = useDataCommand("forgotPassword");
  const active = mode === "sign-in" ? signIn : mode === "sign-up" ? signUp : recover;
  return <form className="auth-form" onSubmit={async event => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");
    try {
      if (mode === "forgot-password") { await recover.mutateAsync({ email }); router.push(`/forgot-password/sent?email=${encodeURIComponent(email)}`); return; }
      if (mode === "sign-up") { await signUp.mutateAsync({ name: String(values.get("name") ?? "").trim(), email, password }); router.push("/verify-student"); return; }
      await signIn.mutateAsync({ email, password });
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next?.startsWith("/") && !next.startsWith("//") ? next : "/discover");
    } catch { /* Error is shown below. */ }
  }}>
    {mode === "sign-up" && <label>Full name<input name="name" autoComplete="name" required placeholder="Samuel Adeyemi" /></label>}
    <label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@university.edu.ng" /></label>
    {mode !== "forgot-password" && <label>Password<input name="password" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={8} required /><small>Use at least 8 characters.</small></label>}
    {active.isError && <p className="field-error" role="alert">{errorMessage(active.error)}</p>}
    <Button type="submit" disabled={active.isPending}>{active.isPending ? "Please wait…" : mode === "sign-in" ? "Sign in" : mode === "sign-up" ? "Create account" : "Send recovery link"}</Button>
    {mode === "sign-in" && <Link href="/forgot-password">Forgot password?</Link>}
  </form>;
}
