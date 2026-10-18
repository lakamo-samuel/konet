"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useDataCommand } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
import { uploadProviderCover } from "@/lib/uploads/provider-cover-file";
import { OnboardingState } from "./onboarding-state";
import type { OwnProviderProfile } from "@/types/provider-onboarding";
export function ProfileStep() {
  return (
    <OnboardingState requireProfile={false}>
      {(data) => (
        <ProfileEditor key={data.profile?.id ?? "new"} profile={data.profile} />
      )}
    </OnboardingState>
  );
}
function ProfileEditor({ profile }: { profile: OwnProviderProfile | null }) {
  const save = useDataCommand(
    profile ? "updateProviderProfile" : "createProviderProfile",
  );
  const router = useRouter();
  const [coverImageUrl, setCoverImageUrl] = useState(
    profile?.coverImageUrl ?? "",
  );
  const [uploading, setUploading] = useState(false);
  const [uploadFailure, setUploadFailure] = useState("");
  const uploadController = useRef<AbortController | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => uploadController.current?.abort(), []);
  return (
    <form
      className="surface-panel form-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        try {
          await save.mutateAsync({
            professionalTitle: String(values.get("professionalTitle")).trim(),
            bio: String(values.get("bio")).trim(),
            responseTimeMinutes: Number(values.get("responseTimeMinutes")),
            ...(coverImageUrl ? { coverImageUrl } : {}),
          });
          router.push("/provider/onboarding/service");
        } catch {
          /* Error below. */
        }
      }}
    >
      {profile?.reviewStatus === "approved" && (
        <p>
          Changing your title, bio or cover requires another admin review before
          publication.
        </p>
      )}
      <label className="field">
        Professional title
        <input
          name="professionalTitle"
          required
          minLength={3}
          defaultValue={profile?.professionalTitle}
        />
      </label>
      <label className="field">
        Professional bio
        <textarea
          name="bio"
          required
          minLength={40}
          rows={6}
          defaultValue={profile?.bio}
        />
      </label>
      <label className="field">
        Response time (minutes)
        <input
          name="responseTimeMinutes"
          type="number"
          min={1}
          max={10080}
          step={1}
          required
          defaultValue={profile?.responseTimeMinutes ?? 60}
        />
      </label>
      <div className="form-stack">
        <span className="field">Public cover image (optional)</span>
        {coverImageUrl && (
          <Image
            src={coverImageUrl}
            alt="Provider cover preview"
            className="h-40 w-full rounded-xl object-cover"
            width={1200}
            height={675}
            unoptimized
          />
        )}
        <div className="inline-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={uploading || save.isPending}
            onClick={() => coverInput.current?.click()}
          >
            {uploading
              ? "Uploading…"
              : coverImageUrl
                ? "Change cover image"
                : "Upload cover image"}
          </Button>
          <input
            ref={coverInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Upload public provider cover image"
            disabled={uploading || save.isPending}
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setUploading(true);
              setUploadFailure("");
              uploadController.current = new AbortController();
              try {
                setCoverImageUrl(
                  await uploadProviderCover(
                    file,
                    uploadController.current.signal,
                  ),
                );
              } catch (cause) {
                if (!uploadController.current.signal.aborted)
                  setUploadFailure(errorMessage(cause));
              } finally {
                setUploading(false);
                event.target.value = "";
              }
            }}
          />
        </div>
        <p>
          JPEG, PNG or WebP up to 5 MiB. Your image will be optimized for
          display.
        </p>
        {uploading && <p role="status">Uploading your cover image…</p>}
        {uploadFailure && <p role="alert">{uploadFailure}</p>}
      </div>
      {save.isError && <p role="alert">{errorMessage(save.error)}</p>}
      <Button type="submit" disabled={save.isPending || uploading}>
        {save.isPending ? "Saving…" : "Save and continue"}
      </Button>
    </form>
  );
}
