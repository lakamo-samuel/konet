"use client";
import { useState } from "react";
import { useDataCommand } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
import { Button } from "@/components/ui/button";
import {
  adminCommands,
  type AdminCommand,
  type AdminRecord,
  type AdminResponse,
  type Params,
  validateAdminInput,
} from "../operations";
import { display, text } from "../resources";
export function AdminAction({
  operation,
  params = {},
  initial = {},
  onSuccess,
}: {
  operation: AdminCommand;
  params?: Params;
  initial?: AdminRecord;
  onSuccess?: (result: AdminResponse) => void;
}) {
  const definition = adminCommands[operation];
  const command = useDataCommand("adminCommand");
  const [review, setReview] = useState<AdminRecord | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const defaults = Object.fromEntries(
    definition.fields.map((field) => [
      field.name,
      initial[field.name] ??
        field.initial ??
        (field.type === "boolean" ? false : ""),
    ]),
  );
  async function submit(values: AdminRecord) {
    setError("");
    setSuccess(false);
    try {
      validateAdminInput("command", { operation, params, values });
      const result = await command.mutateAsync({ operation, params, values });
      setReview(null);
      setSuccess(true);
      onSuccess?.(result);
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  return (
    <section className="admin-action">
      <h3>{definition.label}</h3>
      {review ? (
        <div className="admin-confirm">
          <p>
            Review this action before submitting. It will be recorded in the
            audit trail.
          </p>
          <dl>
            {Object.entries(review).map(([key, value]) => (
              <div key={key}>
                <dt>
                  {definition.fields.find((field) => field.name === key)
                    ?.label ?? key}
                </dt>
                <dd>{display(key, value)}</dd>
              </div>
            ))}
          </dl>
          <div className="admin-buttons">
            <Button
              disabled={command.isPending}
              onClick={() => void submit(review)}
            >
              {command.isPending
                ? "Submitting…"
                : `Confirm: ${definition.label}`}
            </Button>
            <Button
              variant="secondary"
              disabled={command.isPending}
              onClick={() => setReview(null)}
            >
              Back
            </Button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            setSuccess(false);
            const form = new FormData(event.currentTarget);
            const values: AdminRecord = {};
            for (const field of definition.fields) {
              const raw = form.get(field.name);
              if (field.nullable && (raw === null || String(raw).trim() === ""))
                values[field.name] = null;
              else if (field.type === "boolean")
                values[field.name] = raw === "on";
              else if (raw !== null && String(raw).trim() !== "")
                values[field.name] =
                  field.type === "number"
                    ? Number(raw)
                    : field.type === "datetime-local"
                      ? new Date(String(raw)).toISOString()
                      : String(raw).trim();
            }
            try {
              validateAdminInput("command", { operation, params, values });
              if (definition.confirm) setReview(values);
              else void submit(values);
            } catch (err) {
              setError(errorMessage(err));
            }
          }}
        >
          {definition.fields.map((field) => (
            <label key={field.name}>
              {field.label}
              {field.type === "select" ? (
                <select
                  name={field.name}
                  defaultValue={
                    text(defaults[field.name]) === "—"
                      ? ""
                      : String(defaults[field.name])
                  }
                  required={field.required}
                >
                  <option value="">Choose…</option>
                  {field.options?.map((option) => (
                    <option key={option} value={option}>
                      {option.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
                <textarea
                  name={field.name}
                  defaultValue={String(defaults[field.name])}
                  minLength={field.min}
                  maxLength={field.max}
                  required={field.required}
                  rows={3}
                />
              ) : field.type === "boolean" ? (
                <input
                  name={field.name}
                  type="checkbox"
                  defaultChecked={Boolean(defaults[field.name])}
                />
              ) : (
                <input
                  name={field.name}
                  type={field.type ?? "text"}
                  defaultValue={String(defaults[field.name])}
                  required={field.required}
                  readOnly={field.readOnly}
                  min={field.type === "number" ? field.min : undefined}
                  max={field.type === "number" ? field.max : undefined}
                  minLength={field.type !== "number" ? field.min : undefined}
                  maxLength={field.type !== "number" ? field.max : undefined}
                  autoComplete={
                    field.type === "password" ? "current-password" : "off"
                  }
                />
              )}
            </label>
          ))}
          <Button type="submit" disabled={command.isPending}>
            {command.isPending
              ? "Submitting…"
              : definition.confirm
                ? "Review action"
                : definition.label}
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {success && (
        <p role="status">
          Action completed. The latest records have been refreshed.
        </p>
      )}
    </section>
  );
}
