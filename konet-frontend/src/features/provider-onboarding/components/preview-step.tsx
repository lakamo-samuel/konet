"use client";
import { Button } from "@/components/ui/button";
import { useDataCommand } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
import { formatNaira } from "@/lib/formatters/currency";
import { verificationLabels } from "@/features/verification/components/verification-history";
import { OnboardingState, providerEditsLocked } from "./onboarding-state";
import type {
  ProviderOnboarding,
  OwnProviderService,
} from "@/types/provider-onboarding";
export function PreviewStep() {
  return (
    <OnboardingState readOnly>
      {(data) => <ProviderReview data={data} />}
    </OnboardingState>
  );
}
function ProviderReview({ data }: { data: ProviderOnboarding }) {
  const submit = useDataCommand("submitProviderProfile");
  const publish = useDataCommand("publishProvider");
  const profile = data.profile!;
  return (
    <div className="surface-panel form-stack">
      <h2>{profile.professionalTitle}</h2>
      <p>{profile.bio}</p>
      <p>
        Profile status: {profile.status.replaceAll("_", " ")} · Review:{" "}
        {profile.reviewStatus.replaceAll("_", " ")}
      </p>
      {data.verification.map((v) => (
        <p key={v.id}>
          {v.dimension.toUpperCase()}: {verificationLabels[v.status]}
          {v.reason ? ` · ${v.reason}` : ""}
        </p>
      ))}
      {data.portfolio.length > 0 && (
        <section>
          <h3>Portfolio</h3>
          {data.portfolio.map((p) => (
            <article key={p.id}>
              <strong>{p.title}</strong>
              <p>{p.description}</p>
            </article>
          ))}
        </section>
      )}
      <section className="form-stack">
        <h3>Services</h3>
        {!data.services.length && (
          <p>Add at least one service before submitting.</p>
        )}
        {data.services.map((s) => (
          <ServiceStatus
            key={s.id}
            service={s}
            canActivate={
              profile.status === "active" && profile.reviewStatus === "approved"
            }
            locked={providerEditsLocked(data)}
          />
        ))}
      </section>
      {profile.reviewStatus === "pending" && (
        <p role="status">
          Your application is awaiting admin review. You can check the decision
          here.
        </p>
      )}
      {profile.reviewStatus === "approved" && profile.status !== "active" && (
        <p>
          Your profile is approved. Publish it, then activate the services you
          want clients to book.
        </p>
      )}
      {profile.status === "active" && (
        <p role="status">
          Your provider profile is published. Active services are visible to
          clients.
        </p>
      )}
      {profile.reviewStatus !== "pending" &&
        profile.reviewStatus !== "approved" && (
          <>
            <p>
              Submit after identity and work evidence are pending or verified
              and at least one service has been saved.
            </p>
            <Button
              disabled={
                !data.canSubmit ||
                submit.isPending ||
                profile.status === "suspended"
              }
              onClick={() => void submit.mutateAsync({}).catch(() => {})}
            >
              {submit.isPending ? "Submitting…" : "Submit for admin review"}
            </Button>
          </>
        )}
      {data.canPublish && profile.status !== "active" && (
        <Button
          disabled={publish.isPending || profile.status === "suspended"}
          onClick={() => void publish.mutateAsync({}).catch(() => {})}
        >
          {publish.isPending ? "Publishing…" : "Publish provider profile"}
        </Button>
      )}
      {submit.isError && <p role="alert">{errorMessage(submit.error)}</p>}
      {publish.isError && <p role="alert">{errorMessage(publish.error)}</p>}
      {profile.status === "active" && (
        <Button href={`/providers/${profile.id}`} variant="secondary">
          View public profile
        </Button>
      )}
      {!providerEditsLocked(data) && (
        <Button href="/provider/onboarding/profile" variant="secondary">
          Edit profile
        </Button>
      )}
    </div>
  );
}
export function ServiceStatus({
  service,
  canActivate,
  locked,
}: {
  service: OwnProviderService;
  canActivate: boolean;
  locked: boolean;
}) {
  const update = useDataCommand("updateProviderService");
  return (
    <article className="surface-panel">
      <h4>{service.title}</h4>
      <p>
        {service.pricingType === "custom_quote"
          ? "Custom quote"
          : formatNaira((service.priceMinor ?? 0) / 100)}{" "}
        · {service.status}
      </p>
      {!locked && service.status !== "archived" && (
        <Button
          type="button"
          variant="secondary"
          disabled={
            update.isPending || (service.status !== "active" && !canActivate)
          }
          onClick={() =>
            void update
              .mutateAsync({
                id: service.id,
                values: {
                  status: service.status === "active" ? "paused" : "active",
                },
              })
              .catch(() => {})
          }
        >
          {service.status === "active" ? "Pause service" : "Activate service"}
        </Button>
      )}
      {update.isError && <p role="alert">{errorMessage(update.error)}</p>}
    </article>
  );
}
