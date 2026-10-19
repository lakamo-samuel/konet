"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/data/access/client";
import { useDataCommand, useDataQuery } from "@/lib/query/hooks";
import { uploadProviderCover } from "@/lib/uploads/provider-cover-file";
import type { OwnProviderProfile } from "@/types/provider-onboarding";
import type { CommandInput } from "@/data/access/contracts";
export function ProviderSettingsForm() {
  const profile = useDataQuery("ownProviderProfile", {});
  if (profile.isPending) return <p role="status">Loading provider settings…</p>;
  if (profile.isError)
    return (
      <p role="alert">
        {errorMessage(profile.error)}{" "}
        <Button href="/provider/onboarding" variant="secondary">
          Provider onboarding
        </Button>
      </p>
    );
  return <ProviderEditor key={profile.data.id} profile={profile.data} />;
}
function ProviderEditor({ profile }: { profile: OwnProviderProfile }) {
  const save = useDataCommand("updateProviderSettings");
  const status = useDataCommand("setProviderStatus");
  const [failure, setFailure] = useState("");
  const [saved, setSaved] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState(
    profile.coverImageUrl ?? "",
  );
  const [uploadFailure, setUploadFailure] = useState("");
  const [uploading, setUploading] = useState(false);
  const uploadController = useRef<AbortController | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => uploadController.current?.abort(), []);
  const pending = save.isPending || status.isPending || uploading;
  return (
    <div className="form-stack">
      <form
        className="surface-panel form-stack"
        onChange={() => setSaved(false)}
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending) return;
          setFailure("");
          setSaved(false);
          const values = new FormData(event.currentTarget);
          const input: CommandInput<"updateProviderSettings"> = {};
          const professionalTitle = String(
            values.get("professionalTitle"),
          ).trim();
          const bio = String(values.get("bio")).trim();
          const responseTimeMinutes = Number(values.get("responseTimeMinutes"));
          const availability = String(values.get("availability")) as
            "available" | "unavailable" | "limited";
          if (professionalTitle !== profile.professionalTitle)
            input.professionalTitle = professionalTitle;
          if (bio !== profile.bio) input.bio = bio;
          if (coverImageUrl !== (profile.coverImageUrl ?? ""))
            input.coverImageUrl = coverImageUrl;
          if (responseTimeMinutes !== profile.responseTimeMinutes)
            input.responseTimeMinutes = responseTimeMinutes;
          if (availability !== profile.availability)
            input.availability = availability;
          if (!Object.keys(input).length) {
            setFailure("No provider changes to save.");
            return;
          }
          try {
            await save.mutateAsync(input);
            setSaved(true);
          } catch (cause) {
            setFailure(errorMessage(cause));
          }
        }}
      >
        <h2>Provider profile</h2>
        <p>
          Status: {profile.status.replaceAll("_", " ")} · Review:{" "}
          {profile.reviewStatus.replaceAll("_", " ")}
        </p>
        {profile.reviewReason && <p>{profile.reviewReason}</p>}
        {profile.reviewStatus === "pending" && (
          <p>
            Wait for the current review decision before editing this profile.
          </p>
        )}
        <p>
          Changing your title, bio or cover requires another review before
          publication. Availability and response-time updates retain approval.
        </p>
        <fieldset
          disabled={
            pending ||
            profile.status === "suspended" ||
            profile.reviewStatus === "pending"
          }
          className="form-stack"
        >
          <label className="field">
            Professional title
            <input
              name="professionalTitle"
              required
              minLength={3}
              maxLength={255}
              defaultValue={profile.professionalTitle}
            />
          </label>
          <label className="field">
            Bio
            <textarea
              name="bio"
              required
              minLength={40}
              maxLength={10000}
              rows={6}
              defaultValue={profile.bio}
            />
          </label>
          <div className="form-stack">
            <span className="field">Public cover image</span>
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
                disabled={pending}
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
                disabled={pending}
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
                    setSaved(false);
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
              JPEG, PNG or WebP up to 5 MiB. Upload your image, then save your
              provider profile.
            </p>
            {uploading && <p role="status">Uploading your cover image…</p>}
            {uploadFailure && <p role="alert">{uploadFailure}</p>}
          </div>
          <label className="field">
            Response time (minutes)
            <input
              name="responseTimeMinutes"
              type="number"
              required
              min={1}
              max={10080}
              step={1}
              defaultValue={profile.responseTimeMinutes}
            />
          </label>
          <label className="field">
            Availability
            <select name="availability" defaultValue={profile.availability}>
              <option value="available">Available</option>
              <option value="limited">Limited availability</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </label>
          <Button type="submit">
            {save.isPending ? "Saving…" : "Save provider settings"}
          </Button>
        </fieldset>
        {saved && <p role="status">Provider settings saved.</p>}
        {failure && <p role="alert">{failure}</p>}
      </form>
      <section className="surface-panel form-stack">
        <h2>Publication</h2>
        {profile.status === "suspended" ? (
          <p>This profile is suspended. Contact support for review.</p>
        ) : profile.reviewStatus !== "approved" || !profile.approvedAt ? (
          <p>Complete the review process before publishing.</p>
        ) : (
          <Button
            disabled={pending}
            onClick={() =>
              status.mutate({
                status: profile.status === "active" ? "paused" : "active",
              })
            }
          >
            {status.isPending
              ? "Updating…"
              : profile.status === "active"
                ? "Pause public profile"
                : "Publish public profile"}
          </Button>
        )}
        {status.isError && <p role="alert">{errorMessage(status.error)}</p>}
        <Button href="/provider/onboarding" variant="secondary">
          Review and onboarding
        </Button>
        <Button href="/provider/services" variant="secondary">
          Manage services
        </Button>
        <Button href="/provider/earnings" variant="secondary">
          Earnings and bank account
        </Button>
      </section>
    </div>
  );
}
