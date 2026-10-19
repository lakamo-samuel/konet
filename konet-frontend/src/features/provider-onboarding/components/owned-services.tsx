"use client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { OnboardingState, providerEditsLocked } from "./onboarding-state";
import { ServiceEditor } from "./service-step";
import { ServiceStatus } from "./preview-step";
export function OwnedServices() {
  return (
    <OnboardingState readOnly>
      {(data) => (
        <div className="form-stack">
          {!providerEditsLocked(data) && data.services.length > 0 && (
            <Button href="/provider/services/new">Add service</Button>
          )}
          {data.services.length === 0 && (
            <EmptyState
              icon="grid"
              className="owned-services-empty-state"
              title="No services yet"
              description={
                providerEditsLocked(data)
                  ? "Once your provider profile is approved, you can publish services for clients to discover."
                  : "Add a service to show clients what you can offer."
              }
              action={
                !providerEditsLocked(data) ? (
                  <Button href="/provider/services/new">Add your first service</Button>
                ) : undefined
              }
            />
          )}
          {data.services.map((service) => (
            <div key={service.id}>
              <ServiceStatus
                service={service}
                canActivate={
                  data.profile?.status === "active" &&
                  data.profile.reviewStatus === "approved"
                }
                locked={providerEditsLocked(data)}
              />
              {!providerEditsLocked(data) && service.status !== "archived" && (
                <Button
                  variant="quiet"
                  href={`/provider/services/${service.id}`}
                >
                  Edit service
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </OnboardingState>
  );
}
export function OwnedServiceEditor({ id }: { id?: string }) {
  return (
    <OnboardingState>
      {(data) => {
        const service = id
          ? data.services.find((item) => item.id === id)
          : undefined;
        return id && !service ? (
          <p>This service is unavailable.</p>
        ) : (
          <div className="form-stack">
            <ServiceEditor key={id ?? "new"} service={service} />
            <Button href="/provider/services" variant="secondary">
              Back to services
            </Button>
          </div>
        );
      }}
    </OnboardingState>
  );
}
