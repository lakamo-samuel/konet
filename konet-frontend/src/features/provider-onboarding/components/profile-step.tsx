"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useDataCommand } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
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
  return (
    <form
      className="surface-panel form-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        const cover = String(values.get("coverImageUrl") ?? "").trim();
        try {
          await save.mutateAsync({
            professionalTitle: String(values.get("professionalTitle")).trim(),
            bio: String(values.get("bio")).trim(),
            responseTimeMinutes: Number(values.get("responseTimeMinutes")),
            ...(cover ? { coverImageUrl: cover } : {}),
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
      <label className="field">
        Public cover image URL (optional)
        <input
          name="coverImageUrl"
          type="url"
          pattern="https://.*"
          defaultValue={profile?.coverImageUrl ?? ""}
          placeholder="https://…"
        />
      </label>
      {save.isError && <p role="alert">{errorMessage(save.error)}</p>}
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save and continue"}
      </Button>
    </form>
  );
}
