"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useDataCommand } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
import { uploadPortfolioImage } from "@/lib/uploads/portfolio-image-file";
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
            Portfolio entries are optional. Add a project description, upload
            an image from your device or link to your work.
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
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [assetUrl, setAssetUrl] = useState(item?.assetUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadController = useRef<AbortController | null>(null);
  useEffect(
    () => () => uploadController.current?.abort(),
    [],
  );
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
        const externalUrl = String(values.get("externalUrl") ?? "").trim();
        if (type === "image" && !assetUrl) {
          setUploadError("Upload an image before saving this portfolio entry.");
          return;
        }
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
            setAssetUrl("");
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
      <div className="field">
        <span>Portfolio image{type !== "image" && " (optional)"}</span>
        <p>JPEG, PNG or WebP, up to 5 MiB.</p>
        <input
          ref={fileInput}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Choose a portfolio image from your device"
          disabled={uploading || mutation.isPending}
          onChange={async (event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (!file) return;
            uploadController.current?.abort();
            const controller = new AbortController();
            uploadController.current = controller;
            setUploadError("");
            setUploading(true);
            try {
              const url = await uploadPortfolioImage(file, controller.signal);
              setAssetUrl(url);
            } catch (error) {
              if (!controller.signal.aborted)
                setUploadError(errorMessage(error));
            } finally {
              if (uploadController.current === controller) {
                uploadController.current = null;
                setUploading(false);
              }
            }
            input.value = "";
          }}
        />
        <div className="portfolio-image-control">
          {assetUrl && (
            <Image
              src={assetUrl}
              alt="Portfolio image preview"
              width={160}
              height={120}
              unoptimized
            />
          )}
          <div>
            <Button
              type="button"
              variant="secondary"
              disabled={uploading || mutation.isPending}
              onClick={() => fileInput.current?.click()}
            >
              {uploading ? "Uploading image…" : assetUrl ? "Change image" : "Choose image"}
            </Button>
            {assetUrl && !uploading && (
              <Button
                type="button"
                variant="secondary"
                disabled={mutation.isPending}
                onClick={() => setAssetUrl("")}
              >
                Remove image
              </Button>
            )}
            <small role="status" aria-live="polite">
              {assetUrl ? "Image uploaded" : "Select an image file from your device."}
            </small>
          </div>
        </div>
      </div>
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
      {(uploadError || mutation.isError) && (
        <p role="alert">{uploadError || errorMessage(mutation.error)}</p>
      )}
      {remove.isError && <p role="alert">{errorMessage(remove.error)}</p>}
      <Button type="submit" disabled={mutation.isPending || remove.isPending || uploading}>
        {mutation.isPending ? "Saving…" : "Save portfolio entry"}
      </Button>
      {item && (
        <>
          <Button
            type="button"
            variant="secondary"
            disabled={mutation.isPending || remove.isPending || uploading}
            onClick={() => setConfirmRemove(true)}
          >
            Remove entry
          </Button>
          <ConfirmationDialog
            open={confirmRemove}
            title="Remove this portfolio entry?"
            description="This entry will be removed from your provider profile."
            confirmLabel="Remove entry"
            pendingLabel="Removing…"
            pending={remove.isPending}
            onCancel={() => setConfirmRemove(false)}
            onConfirm={() => remove.mutateAsync({ id: item.id })}
          />
        </>
      )}
    </form>
  );
}
