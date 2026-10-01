"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { errorMessage } from "@/data/access/client";
import { useDataCommand, useDataQuery } from "@/lib/query/hooks";
export function VerificationForm() {
  const [submitted, setSubmitted] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const { data: universities = [], isPending: loading } = useDataQuery("universities", {});
  const verify = useDataCommand("submitVerification");
  if (submitted) return <div className="success-state"><h2>Student verified</h2><p>Your student details are confirmed. You can now use the Konet network.</p><Button href="/discover">Enter Konet</Button></div>;
  return <form className="form-stack" onSubmit={async event => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const universityId = String(values.get("universityId") ?? "");
    if (!universityId) { setFieldError("Select your university."); return; }
    setFieldError("");
    try { const result = await verify.mutateAsync({ universityId, studentNumber: String(values.get("studentNumber") ?? ""), email: String(values.get("email") ?? "") }); if (result.status === "verified") setSubmitted(true); } catch { /* Error is shown below. */ }
  }}>
    <label className="field">University<Select label="University" name="universityId" required defaultValue="" options={[{ value: "", label: loading ? "Loading universities…" : "Select university", disabled: true }, ...universities.map(item => ({ value: item.id, label: item.name }))]} /></label>
    <label className="field">Matriculation number<input name="studentNumber" required /></label>
    <label className="field">Student email<input name="email" type="email" required /></label>
    {fieldError && <p role="alert" className="field-error">{fieldError}</p>}
    {verify.isError && <p role="alert" className="field-error">{errorMessage(verify.error)}</p>}
    <Button type="submit" disabled={loading || verify.isPending}>{verify.isPending ? "Verifying…" : "Verify student status"}</Button>
  </form>;
}
