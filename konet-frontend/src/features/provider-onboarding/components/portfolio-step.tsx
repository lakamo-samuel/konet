"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useDataCommand } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
import { OnboardingState } from "./onboarding-state";
import type {
  OwnPortfolioItem,
  PortfolioType,
} from "@/types/provider-onboarding";
export function PortfolioStep() {
  return (
    <OnboardingState>
      {(data) => (
        <div className="form-stack">
          <p>
            Portfolio entries are optional. Add a project description, public
            HTTPS image URL or link to your work.
          </p>
          {data.profile?.reviewStatus === "approved" && (
            <p>
              Changing portfolio content requires another admin review before
              publication.
            </p>
          )}
          <PortfolioEditor />
          {data.portfolio.map((item) => (
            <PortfolioEditor key={item.id} item={item} />
          ))}
          <Button href="/provider/onboarding/verification" variant="secondary">
            Continue to verification
          </Button>
        </div>
      )}
    </OnboardingState>
  );
}
function PortfolioEditor({ item }: { item?: OwnPortfolioItem }) {
  const [type, setType] = useState<PortfolioType>(item?.type ?? "project");
  const create = useDataCommand("createPortfolioItem");
  const update = useDataCommand("updatePortfolioItem");
  const remove = useDataCommand("deletePortfolioItem");
  const mutation = item ? update : create;
  return (
    <form
      className="surface-panel form-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const values = new FormData(form);
        const assetUrl = String(values.get("assetUrl") ?? "").trim();
        const externalUrl = String(values.get("externalUrl") ?? "").trim();
        const input = {
          type,
          title: String(values.get("title")).trim(),
          description: String(values.get("description") ?? "").trim(),
          ...(assetUrl ? { assetUrl } : {}),
          ...(externalUrl ? { externalUrl } : {}),
        };
        try {
          if (item) await update.mutateAsync({ id: item.id, values: input });
          else {
            await create.mutateAsync(input);
            form.reset();
          }
        } catch {
          /* Error below. */
        }
      }}
    >
      <h3>{item ? item.title : "Add portfolio entry"}</h3>
      <label className="field">
        Entry type
        <select
          value={type}
          onChange={(e) => setType(e.target.value as PortfolioType)}
        >
          {Object.entries({
            project: "Project",
            case_study: "Case study",
            certificate: "Certificate",
            image: "Public image",
            external_link: "External link",
          }).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Title
        <input name="title" required minLength={3} defaultValue={item?.title} />
      </label>
      <label className="field">
        Your contribution
        <textarea
          name="description"
          rows={4}
          defaultValue={item?.description ?? ""}
        />
      </label>
      <label className="field">
        Public image URL{type !== "image" && " (optional)"}
        <input
          type="url"
          pattern="https://.*"
          name="assetUrl"
          required={type === "image"}
          defaultValue={item?.assetUrl ?? ""}
        />
      </label>
      <label className="field">
        Public work link{type !== "external_link" && " (optional)"}
        <input
          type="url"
          pattern="https://.*"
          name="externalUrl"
          required={type === "external_link"}
          defaultValue={item?.externalUrl ?? ""}
        />
      </label>
      {mutation.isError && <p role="alert">{errorMessage(mutation.error)}</p>}
      {remove.isError && <p role="alert">{errorMessage(remove.error)}</p>}
      <Button type="submit" disabled={mutation.isPending || remove.isPending}>
        {mutation.isPending ? "Saving…" : "Save portfolio entry"}
      </Button>
      {item && (
        <Button
          type="button"
          variant="secondary"
          disabled={mutation.isPending || remove.isPending}
          onClick={() => {
            void remove.mutateAsync({ id: item.id }).catch(() => {});
          }}
        >
          Remove entry
        </Button>
      )}
    </form>
  );
}
