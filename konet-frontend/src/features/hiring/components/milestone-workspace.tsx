"use client";
import { useState } from "react";
import { useDataCommand, useDataQuery } from "@/lib/query/hooks";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/data/access/client";
import { futureDate } from "@/lib/formatters/money-input";
import type { HiringJob } from "@/types/hiring";
export function MilestoneWorkspace({
  job,
  provider,
}: {
  job: HiringJob;
  provider: boolean;
}) {
  const milestones = useDataQuery("milestones", { jobId: job.id }, undefined, {
    refetchInterval: 15000,
  });
  const create = useDataCommand("createMilestone");
  const update = useDataCommand("updateMilestone");
  const [error, setError] = useState("");
  const editable =
    provider &&
    ["awaiting_payment", "scheduled", "in_progress"].includes(job.status);
  return (
    <section className="surface-panel form-stack">
      <h3>Milestones</h3>
      {milestones.isPending && <p>Loading milestones…</p>}
      {milestones.isError && (
        <p role="alert">{errorMessage(milestones.error)}</p>
      )}
      {milestones.data?.length === 0 && <p>No milestones have been added.</p>}
      {milestones.data?.map((m) => (
        <article key={m.id}>
          <strong>{m.title}</strong>
          <p>{m.description}</p>
          <p>
            {m.status.replaceAll("_", " ")}
            {m.dueAt ? ` · Due ${new Date(m.dueAt).toLocaleString()}` : ""}
          </p>
          {editable &&
            job.status === "in_progress" &&
            m.status !== "completed" && (
              <Button
                type="button"
                variant="secondary"
                disabled={update.isPending}
                onClick={() =>
                  update.mutate({
                    jobId: job.id,
                    id: m.id,
                    status:
                      m.status === "pending" ? "in_progress" : "completed",
                  })
                }
              >
                {m.status === "pending"
                  ? "Start milestone"
                  : "Complete milestone"}
              </Button>
            )}
        </article>
      ))}
      {editable && (
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            const form = e.currentTarget;
            const data = new FormData(form);
            try {
              await create.mutateAsync({
                jobId: job.id,
                title: String(data.get("title")).trim(),
                description: String(data.get("description") ?? "").trim(),
                dueAt: futureDate(String(data.get("dueAt") ?? "")),
              });
              form.reset();
            } catch (cause) {
              setError(errorMessage(cause));
            }
          }}
        >
          <label className="field">
            Milestone title
            <input name="title" minLength={3} maxLength={160} required />
          </label>
          <label className="field">
            Description
            <textarea name="description" maxLength={10000} />
          </label>
          <label className="field">
            Due date (optional)
            <input name="dueAt" type="datetime-local" />
          </label>
          <Button type="submit" disabled={create.isPending}>
            Add milestone
          </Button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      {update.isError && <p role="alert">{errorMessage(update.error)}</p>}
    </section>
  );
}
