"use client";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/data/access/client";
import { useDataQuery } from "@/lib/query/hooks";
import type { ProviderOnboarding } from "@/types/provider-onboarding";
export function providerEditsLocked(data: ProviderOnboarding) {
  return (
    data.profile?.reviewStatus === "pending" ||
    data.profile?.status === "suspended"
  );
}
export function OnboardingState({
  children,
  requireProfile = true,
  readOnly = false,
}: {
  children: (data: ProviderOnboarding) => ReactNode;
  requireProfile?: boolean;
  readOnly?: boolean;
}) {
  const state = useDataQuery("onboarding", {}, undefined, {
    refetchInterval: 15_000,
  });
  if (state.isPending) return <p role="status">Loading provider setup…</p>;
  if (state.isError)
    return (
      <div>
        <p role="alert">{errorMessage(state.error)}</p>
        <Button type="button" onClick={() => void state.refetch()}>
          Try again
        </Button>
      </div>
    );
  if (requireProfile && !state.data.profile)
    return (
      <div className="form-stack">
        <p>Create your provider profile first.</p>
        <Button href="/provider/onboarding/profile">Create profile</Button>
      </div>
    );
  return (
    <div className="form-stack">
      {state.data.profile?.reviewReason && (
        <p>
          <strong>Review feedback:</strong> {state.data.profile.reviewReason}
        </p>
      )}
      {!readOnly && providerEditsLocked(state.data) ? (
        <div>
          <p>
            {state.data.profile?.status === "suspended"
              ? "Your profile is suspended. Contact support for assistance."
              : "Your profile is awaiting admin review. Editing is paused until a decision is made."}
          </p>
          <Button href="/provider/onboarding/preview">
            View review status
          </Button>
        </div>
      ) : (
        children(state.data)
      )}
    </div>
  );
}
