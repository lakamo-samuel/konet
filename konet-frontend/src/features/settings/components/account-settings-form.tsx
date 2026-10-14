"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { useDataCommand, useDataQuery } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
import { uploadAvatar } from "@/lib/uploads/avatar-file";
import type { User } from "@/types/domain";
import type { AccountProfileInput } from "@/types/account-settings";
import { AccountSecurity } from "./account-security";
export function AccountSettingsForm() {
  const user = useDataQuery("currentUser", {});
  if (user.isPending) return <p role="status">Loading account…</p>;
  if (user.isError) return <p role="alert">{errorMessage(user.error)}</p>;
  return (
    <div className="form-stack">
      <ProfileForm key={user.data.id} user={user.data} />
      <AccountSecurity email={user.data.email} />
    </div>
  );
}
function ProfileForm({ user }: { user: User }) {
  const [universityId, setUniversityId] = useState(user.universityId);
  const [campusId, setCampusId] = useState(user.campusId ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    user.avatar || null,
  );
  const [confirmed, setConfirmed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failure, setFailure] = useState("");
  const [uploading, setUploading] = useState(false);
  const uploadController = useRef<AbortController | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => uploadController.current?.abort(), []);
  const universities = useDataQuery("universities", {});
  const university = useDataQuery(
    "university",
    { id: universityId },
    undefined,
    { enabled: !!universityId },
  );
  const save = useDataCommand("updateAccountProfile");
  const moved =
    universityId !== user.universityId || campusId !== user.campusId;
  return (
    <form
      className="surface-panel form-stack"
      onChange={() => setSaved(false)}
      onSubmit={async (event) => {
        event.preventDefault();
        if (save.isPending) return;
        setFailure("");
        const values = new FormData(event.currentTarget);
        const input: AccountProfileInput = {};
        const fullName = String(values.get("fullName")).trim();
        if (fullName !== user.name) input.fullName = fullName;
        if (avatarUrl !== (user.avatar || null)) input.avatarUrl = avatarUrl;
        if (moved) {
          if (!confirmed) {
            setFailure(
              "Confirm that changing affiliation requires verification again.",
            );
            return;
          }
          if (!university.data?.campusOptions?.some((c) => c.id === campusId)) {
            setFailure("Choose a campus belonging to the selected university.");
            return;
          }
          input.universityId = universityId;
          input.campusId = campusId;
        }
        if (!Object.keys(input).length) {
          setFailure("No profile changes to save.");
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
      <h2>Profile details</h2>
      <div className="form-stack">
        <span className="field">Profile picture</span>
        <div className="inline-actions">
          <Avatar src={avatarUrl ?? ""} name={user.name} size={96} />
          <Button
            type="button"
            variant="secondary"
            disabled={uploading || save.isPending}
            onClick={() => avatarInput.current?.click()}
          >
            {uploading
              ? "Uploading…"
              : avatarUrl
                ? "Change picture"
                : "Upload picture"}
          </Button>
          <input
            ref={avatarInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Upload profile picture"
            disabled={uploading || save.isPending}
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setUploading(true);
              setFailure("");
              uploadController.current = new AbortController();
              try {
                const url = await uploadAvatar(
                  file,
                  uploadController.current.signal,
                );
                setAvatarUrl(url);
                setSaved(false);
              } catch (cause) {
                if (!uploadController.current.signal.aborted)
                  setFailure(errorMessage(cause));
              } finally {
                setUploading(false);
                event.target.value = "";
              }
            }}
          />
          {avatarUrl && (
            <Button
              type="button"
              variant="secondary"
              disabled={uploading || save.isPending}
              onClick={() => {
                setAvatarUrl(null);
                setSaved(false);
              }}
            >
              Remove picture
            </Button>
          )}
        </div>
        <p>JPEG, PNG or WebP up to 5 MiB. Your picture is optimized for display.</p>
        {uploading && <p role="status">Uploading your picture…</p>}
        {!uploading && avatarUrl !== (user.avatar || null) && (
          <p role="status">Picture ready. Save your profile to apply it.</p>
        )}
      </div>
      <label className="field">
        Full name
        <input
          name="fullName"
          required
          minLength={2}
          maxLength={150}
          defaultValue={user.name}
        />
      </label>
      <p>
        Login email: {user.email}. Use the separate email-change form below to
        change it.
      </p>
      <label className="field">
        University
        <select
          value={universityId}
          disabled={universities.isPending || save.isPending}
          onChange={(event) => {
            setUniversityId(event.target.value);
            setCampusId("");
            setConfirmed(false);
          }}
        >
          <option value={user.universityId}>
            {universities.data?.find((u) => u.id === user.universityId)?.name ??
              "Current university"}
          </option>
          {universities.data
            ?.filter((u) => u.id !== user.universityId)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
        </select>
      </label>
      <label className="field">
        Campus
        <select
          required
          value={campusId}
          disabled={university.isPending || save.isPending}
          onChange={(event) => {
            setCampusId(event.target.value);
            setConfirmed(false);
          }}
        >
          <option value="">Choose a campus</option>
          {university.data?.campusOptions?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          {user.campusId &&
            !university.data?.campusOptions?.some(
              (c) => c.id === user.campusId,
            ) &&
            universityId === user.universityId && (
              <option value={user.campusId}>{user.campus}</option>
            )}
        </select>
      </label>
      {(universities.isError || university.isError) && (
        <p role="alert">
          {errorMessage(universities.error ?? university.error)}{" "}
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void universities.refetch();
              void university.refetch();
            }}
          >
            Reload directory
          </Button>
        </p>
      )}
      {moved && (
        <label className="check-row">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          I understand this resets student verification and provider
          approval/publication. Active jobs or unsettled payments must be
          resolved first.
        </label>
      )}
      {failure && <p role="alert">{failure}</p>}
      {saved && <p role="status">Profile saved.</p>}
      <Button
        type="submit"
        disabled={save.isPending || uploading || (moved && !confirmed)}
      >
        {save.isPending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
