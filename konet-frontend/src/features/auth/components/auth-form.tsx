"use client";
import { safeReturnPath } from "@/lib/auth/navigation";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/data/access/client";
import { useDataCommand, useDataQuery } from "@/lib/query/hooks";
export function AuthForm({
  mode,
}: {
  mode: "sign-in" | "sign-up" | "forgot-password";
}) {
  const router = useRouter();
  const [school, setSchool] = useState("");
  const universities = useDataQuery("universities", {});
  const selected = universities.data?.find((u) => u.id === school);
  const signIn = useDataCommand("signIn");
  const signUp = useDataCommand("signUp");
  const recover = useDataCommand("forgotPassword");
  const active =
    mode === "sign-in" ? signIn : mode === "sign-up" ? signUp : recover;
  return (
    <form
      className="auth-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        const email = String(values.get("email") ?? "").trim();
        const password = String(values.get("password") ?? "");
        try {
          if (mode === "forgot-password") {
            await recover.mutateAsync({ email });
            router.push(
              `/forgot-password/sent?email=${encodeURIComponent(email)}`,
            );
            return;
          }
          if (mode === "sign-up") {
            await signUp.mutateAsync({
              name: String(values.get("name") ?? "").trim(),
              email,
              password,
              universityId: String(values.get("universityId") ?? ""),
              campusId: String(values.get("campusId") ?? ""),
            });
            router.push("/verify-student");
            return;
          }
          await signIn.mutateAsync({ email, password });
          const next = new URLSearchParams(window.location.search).get("next");
          router.push(safeReturnPath(next));
        } catch {
          /* Error is shown below. */
        }
      }}
    >
      {mode === "sign-up" && (
        <label>
          Full name
          <input
            name="name"
            autoComplete="name"
            minLength={2}
            maxLength={150}
            required
            placeholder="Samuel Adeyemi"
          />
        </label>
      )}
      {mode === "sign-up" && (
        <>
          <label>
            University
            <select
              name="universityId"
              value={school}
              onChange={(event) => setSchool(event.target.value)}
              required
              disabled={universities.isPending}
            >
              <option value="">Select your university</option>
              {universities.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Campus
            <select
              name="campusId"
              key={school}
              defaultValue=""
              required
              disabled={!school}
            >
              <option value="">Select your campus</option>
              {(
                selected?.campusOptions ??
                selected?.campuses.map((name) => ({ id: name, name })) ??
                []
              ).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {universities.isError && (
            <p role="alert" className="field-error">
              Universities could not be loaded.{" "}
              <button type="button" onClick={() => void universities.refetch()}>
                Try again
              </button>
            </p>
          )}
        </>
      )}
      <label>
        Email address
        <input
          name="email"
          type="email"
          autoComplete="email"
          maxLength={255}
          required
          placeholder="you@university.edu.ng"
        />
      </label>
      {mode !== "forgot-password" && (
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
            minLength={8}
            maxLength={1024}
            required
          />
          {mode === "sign-up" && <small>Use at least 8 characters.</small>}
        </label>
      )}
      {active.isError && (
        <p className="field-error" role="alert">
          {errorMessage(active.error)}
        </p>
      )}
      <Button
        type="submit"
        disabled={
          active.isPending ||
          (mode === "sign-up" &&
            (universities.isPending || universities.isError || !selected))
        }
      >
        {active.isPending
          ? "Please wait…"
          : mode === "sign-in"
            ? "Sign in"
            : mode === "sign-up"
              ? "Create account"
              : "Send recovery link"}
      </Button>
      {mode === "sign-in" && (
        <Link href="/forgot-password">Forgot password?</Link>
      )}
    </form>
  );
}
