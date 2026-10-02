"use client";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { errorMessage } from "@/data/access/client";
import { useDataCommand, useDataQuery } from "@/lib/query/hooks";
import { PrivateEvidenceUpload } from "@/features/uploads/components/private-evidence-upload";
import {
  VerificationHistory,
  methodLabels,
  verificationLabels,
} from "./verification-history";
import type {
  EmailChallenge,
  PrivateUpload,
  StudentVerificationMethod,
} from "@/types/verification";
import type { User } from "@/types/domain";

export function VerificationForm() {
  const user = useDataQuery("currentUser", {});
  if (user.isPending) return <p role="status">Loading your student account…</p>;
  if (user.isError)
    return (
      <div>
        <p role="alert">{errorMessage(user.error)}</p>
        <Button type="button" onClick={() => void user.refetch()}>
          Try again
        </Button>
      </div>
    );
  return (
    <StudentVerificationForm
      key={`${user.data.id}:${user.data.universityId}:${user.data.campusId}`}
      user={user.data}
    />
  );
}
function StudentVerificationForm({ user }: { user: User }) {
  const methods = useDataQuery("verificationMethods", {
    universityId: user.universityId,
  });
  const history = useDataQuery("studentVerifications", {}, undefined, {
    refetchInterval: 15_000,
  });
  const [selectedMethod, setSelectedMethod] = useState<
    StudentVerificationMethod | ""
  >("");
  const [challenge, setChallenge] = useState<EmailChallenge | null>(null);
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [code, setCode] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [readyUpload, setReadyUpload] = useState<PrivateUpload | null>(null);
  const [fieldError, setFieldError] = useState("");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const send = useDataCommand("requestVerificationCode");
  const confirm = useDataCommand("confirmVerificationCode");
  const submit = useDataCommand("submitVerification");
  const cache = useQueryClient();
  const pendingDocument = history.data?.some(
    (r) => r.status === "pending" && r.method !== "university_email",
  );
  const verified = user.studentVerification === "verified";
  const method = selectedMethod || methods.data?.methods[0] || "";
  useEffect(() => {
    if (!challenge) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [challenge]);
  // Manual decisions can happen while this page is open. Refresh account eligibility with the history.
  useEffect(() => {
    if (history.data)
      void cache.invalidateQueries({ queryKey: ["konet", "currentUser"] });
  }, [history.data, cache]);
  const seconds = challenge
    ? Math.max(0, Math.ceil((Date.parse(challenge.resendAfter) - now) / 1000))
    : 0;
  const expired = !!challenge && Date.parse(challenge.expiresAt) <= now;
  const busy = send.isPending || confirm.isPending || submit.isPending;
  return (
    <div className="form-stack">
      <p>
        <strong>Current status:</strong>{" "}
        {user.studentVerification === "pending" && !pendingDocument
          ? "Awaiting email confirmation"
          : (verificationLabels[user.studentVerification] ??
            user.studentVerification)}
      </p>
      <p>
        Verification applies to your account’s university and {user.campus}{" "}
        campus.
      </p>
      {verified && (
        <div className="success-state">
          <h2>Student verified</h2>
          <p>Your student status is confirmed.</p>
          <Button href="/discover">Enter Konet</Button>
        </div>
      )}
      {!verified && pendingDocument && (
        <p role="status">
          Your document is awaiting an admin review. Check here for a decision
          or feedback. You cannot submit another verification while it is
          pending.
        </p>
      )}
      {history.isPending && <p role="status">Loading verification history…</p>}
      {history.isError && (
        <div>
          <p role="alert">{errorMessage(history.error)}</p>
          <Button type="button" onClick={() => void history.refetch()}>
            Reload verification history
          </Button>
        </div>
      )}
      {methods.isError && !verified && (
        <div>
          <p role="alert">{errorMessage(methods.error)}</p>
          <Button type="button" onClick={() => void methods.refetch()}>
            Reload available methods
          </Button>
        </div>
      )}
      {!verified &&
        !pendingDocument &&
        history.isSuccess &&
        methods.isSuccess && (
          <>
            <label className="field">
              Verification method
              <Select
                label="Verification method"
                value={method}
                disabled={busy}
                onValueChange={(value) => {
                  setSelectedMethod(value as StudentVerificationMethod);
                  setFieldError("");
                  setMessage("");
                }}
                options={methods.data.methods.map((value) => ({
                  value,
                  label: methodLabels[value],
                }))}
              />
            </label>
            <div hidden={method !== "university_email"}>
              <div className="form-stack">
                <p>
                  Use a university email with one of these approved domains:{" "}
                  {methods.data.approvedEmailDomains.join(", ")}. Confirming its
                  code verifies your student status automatically.
                </p>
                <form
                  className="form-stack"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setFieldError("");
                    setMessage("");
                    const normalized = email.trim().toLowerCase();
                    if (
                      !methods.data.approvedEmailDomains.includes(
                        normalized.split("@")[1],
                      )
                    ) {
                      setFieldError(
                        "Use an email address with an approved university domain.",
                      );
                      return;
                    }
                    try {
                      const result = await send.mutateAsync({
                        email: normalized,
                      });
                      setChallenge(result);
                      setSentEmail(normalized);
                      setCode("");
                      setNow(Date.now());
                      setMessage(
                        "A verification code has been queued for your university email.",
                      );
                    } catch {
                      /* Mutation error is rendered below. */
                    }
                  }}
                >
                  <label className="field">
                    University email
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      maxLength={255}
                      required
                      disabled={busy}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </label>
                  <Button type="submit" disabled={busy || seconds > 0}>
                    {send.isPending
                      ? "Sending code…"
                      : seconds > 0
                        ? `Resend available in ${seconds}s`
                        : challenge
                          ? "Send a new code"
                          : "Send verification code"}
                  </Button>
                </form>
                {challenge && (
                  <form
                    className="form-stack"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      setFieldError("");
                      setMessage("");
                      if (!/^\d{6}$/.test(code)) {
                        setFieldError(
                          "Enter the six-digit code from your email.",
                        );
                        return;
                      }
                      try {
                        const result = await confirm.mutateAsync({
                          challengeId: challenge.challengeId,
                          code,
                        });
                        setMessage(
                          result.status === "verified"
                            ? "Your university email is confirmed."
                            : "Your verification status has been updated.",
                        );
                      } catch {
                        /* Error shown below. */
                      }
                    }}
                  >
                    <p>
                      Enter the code sent to {sentEmail}. It expires at{" "}
                      {new Date(challenge.expiresAt).toLocaleTimeString()}.
                    </p>
                    <label className="field">
                      Verification code
                      <input
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        minLength={6}
                        maxLength={6}
                        value={code}
                        required
                        disabled={busy || expired}
                        onChange={(event) =>
                          setCode(event.target.value.replace(/\D/g, ""))
                        }
                      />
                    </label>
                    {expired && (
                      <p role="alert">
                        This code has expired. Request a new code.
                      </p>
                    )}
                    <Button type="submit" disabled={busy || expired}>
                      {confirm.isPending ? "Confirming…" : "Confirm code"}
                    </Button>
                  </form>
                )}
              </div>
            </div>
            <div hidden={method === "university_email"}>
              {method && (
                <form
                  className="form-stack"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setFieldError("");
                    setMessage("");
                    if (!readyUpload || readyUpload.status !== "ready") {
                      setFieldError(
                        "Upload a document and wait for its security scan before submitting.",
                      );
                      return;
                    }
                    if (
                      method === "student_id" &&
                      studentNumber.trim().length < 3
                    ) {
                      setFieldError("Enter your matriculation number.");
                      return;
                    }
                    try {
                      const result = await submit.mutateAsync({
                        method: method as "student_id" | "manual_document",
                        ...(method === "student_id"
                          ? { studentNumber: studentNumber.trim() }
                          : {}),
                        evidenceObjectKey: readyUpload.objectKey,
                      });
                      setMessage(
                        result.status === "pending"
                          ? "Your document has been submitted for admin review."
                          : "Your verification status has been updated.",
                      );
                    } catch {
                      /* Error shown below. */
                    }
                  }}
                >
                  <p>
                    Upload proof that you are a current student. An admin will
                    review it after submission.
                  </p>
                  {method === "student_id" && (
                    <label className="field">
                      Matriculation number
                      <input
                        value={studentNumber}
                        required
                        minLength={3}
                        maxLength={128}
                        disabled={busy}
                        onChange={(event) =>
                          setStudentNumber(event.target.value)
                        }
                      />
                    </label>
                  )}
                  <PrivateEvidenceUpload
                    onReady={setReadyUpload}
                    disabled={busy}
                  />
                  <Button type="submit" disabled={busy || !readyUpload}>
                    {submit.isPending ? "Submitting…" : "Submit for review"}
                  </Button>
                </form>
              )}
            </div>
          </>
        )}
      {message && <p role="status">{message}</p>}
      {fieldError && (
        <p role="alert" className="field-error">
          {fieldError}
        </p>
      )}
      {send.isError && (
        <p role="alert" className="field-error">
          {errorMessage(send.error)}
        </p>
      )}
      {confirm.isError && (
        <p role="alert" className="field-error">
          {errorMessage(confirm.error)}
        </p>
      )}
      {submit.isError && (
        <p role="alert" className="field-error">
          {errorMessage(submit.error)}
        </p>
      )}
      {history.data && <VerificationHistory records={history.data} />}
    </div>
  );
}
