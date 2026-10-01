"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { errorMessage } from "@/data/access/client";
import { useDataCommand } from "@/lib/query/hooks";
export function ContactForm() {
  const [sent, setSent] = useState(false);
  const contact = useDataCommand("contact");
  if (sent) return <div className="surface-panel p-6" role="status"><h2>Message received</h2><p>We’ll reply to your email as soon as we can.</p></div>;
  return <form className="surface-panel form-stack" onSubmit={async event => { event.preventDefault(); const values = new FormData(event.currentTarget); try { await contact.mutateAsync({ email: String(values.get("email") ?? ""), topic: String(values.get("topic") ?? ""), message: String(values.get("message") ?? "").trim() }); setSent(true); } catch { /* Error is shown below. */ } }}>
    <label className="field">Email<input name="email" type="email" required /></label><label className="field">Topic<Select label="Topic" name="topic" options={["Account support", "Payment support", "Safety report", "Campus partnership"].map(label => ({ value: label, label }))} /></label><label className="field">Message<textarea name="message" rows={6} required /></label>{contact.isError && <p className="field-error" role="alert">{errorMessage(contact.error)}</p>}<Button type="submit" disabled={contact.isPending}>{contact.isPending ? "Sending…" : "Send message"}</Button>
  </form>;
}
