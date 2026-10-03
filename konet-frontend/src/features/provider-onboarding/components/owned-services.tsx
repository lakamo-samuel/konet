"use client";
import { Button } from "@/components/ui/button";
import { OnboardingState, providerEditsLocked } from "./onboarding-state";
import { ServiceEditor } from "./service-step";
import { ServiceStatus } from "./preview-step";
export function OwnedServices() {
  return (
    <OnboardingState readOnly>
      {(data) => (
        <div className="form-stack">
          {!providerEditsLocked(data) && (
            <Button href="/provider/services/new">Add service</Button>
          )}
          {data.services.length === 0 && (
            <p>You haven’t added a service yet.</p>
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
