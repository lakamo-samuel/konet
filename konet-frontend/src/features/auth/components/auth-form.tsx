"use client";
import { safeReturnPath } from "@/lib/auth/navigation";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { errorMessage } from "@/data/access/client";
import { useDataCommand, useDataQuery } from "@/lib/query/hooks";
export function AuthForm({
  mode,
}: {
  mode: "sign-in" | "sign-up" | "forgot-password";
}) {
  const router = useRouter();
  const [school, setSchool] = useState("");
  const [campusId, setCampusId] = useState("");
  const universities = useDataQuery("universities", {});
  const selected = universities.data?.find((u) => u.id === school);
  const campusOptions = selected?.campusOptions ?? [];
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
            <Select
              label="University"
              name="universityId"
              value={school}
              onValueChange={(universityId) => {
                const university = universities.data?.find(
                  (item) => item.id === universityId,
                );
                const options = university?.campusOptions ?? [];
                setSchool(universityId);
                setCampusId(options.length === 1 ? options[0].id : "");
              }}
              options={(universities.data ?? []).map((university) => ({
                value: university.id,
                label: university.name,
              }))}
              searchable
              searchPlaceholder="Search universities…"
              placeholder="Select your university"
              required
              disabled={universities.isPending}
              className="auth-select"
            />
          </label>
          <label>
            Campus
            <Select
              label="Campus"
              name="campusId"
              value={campusId}
              onValueChange={setCampusId}
              options={campusOptions.map((campus) => ({
                value: campus.id,
                label: campus.name,
              }))}
              searchable
              searchPlaceholder="Search campuses…"
              placeholder="Select your campus"
              required
              disabled={!school || campusOptions.length === 0}
              className="auth-select"
            />
          </label>
          {universities.isError && (
            <p role="alert" className="field-error">
              Universities could not be loaded.{" "}
              <button type="button" onClick={() => void universities.refetch()}>
                Try again
              </button>
            </p>
          )}
          {!universities.isPending &&
            !universities.isError &&
            universities.data?.length === 0 && (
              <p role="status" className="field-error">
                The university list is being set up. Please try again shortly.
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
            (universities.isPending ||
              universities.isError ||
              !selected ||
              !campusId))
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
