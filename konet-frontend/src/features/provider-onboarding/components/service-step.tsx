"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useDataCommand, useDataQuery } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
import { OnboardingState } from "./onboarding-state";
import { formatNaira } from "@/lib/formatters/currency";
import type {
  OwnProviderService,
  PricingType,
} from "@/types/provider-onboarding";
export function ServiceStep() {
  return (
    <OnboardingState>
      {(data) => (
        <div className="form-stack">
          <ServiceEditor />
          {data.services
            .filter((s) => s.status !== "archived")
            .map((s) => (
              <div className="surface-panel" key={s.id}>
                <h3>{s.title}</h3>
                <p>{s.description}</p>
                <p>
                  {s.priceMinor === null
                    ? "Custom quote"
                    : formatNaira(s.priceMinor / 100)}{" "}
                  · {s.status}
                </p>
                <Button variant="secondary" href={`/provider/services/${s.id}`}>
                  Edit service
                </Button>
              </div>
            ))}
          <Button href="/provider/onboarding/portfolio" variant="secondary">
            Continue to portfolio
          </Button>
        </div>
      )}
    </OnboardingState>
  );
}
export function ServiceEditor({ service }: { service?: OwnProviderService }) {
  const categories = useDataQuery("categories", {});
  const create = useDataCommand("createProviderService");
  const update = useDataCommand("updateProviderService");
  const [pricing, setPricing] = useState<PricingType>(
    service?.pricingType ?? "starting_from",
  );
  const [fieldError, setFieldError] = useState("");
  const mutation = service ? update : create;
  return (
    <form
      className="surface-panel form-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        setFieldError("");
        const form = event.currentTarget;
        const values = new FormData(form);
        const text = String(values.get("price") ?? "");
        if (pricing !== "custom_quote" && !/^\d+(\.\d{1,2})?$/.test(text)) {
          setFieldError(
            "Enter a positive price with up to two decimal places.",
          );
          return;
        }
        const [whole, fraction = ""] = text.split(".");
        const priceMinor =
          Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
        if (
          pricing !== "custom_quote" &&
          (!Number.isSafeInteger(priceMinor) ||
            priceMinor < 1 ||
            priceMinor > 2147483647)
        ) {
          setFieldError("Enter a valid positive price.");
          return;
        }
        const body = {
          title: String(values.get("title")).trim(),
          description: String(values.get("description")).trim(),
          pricingType: pricing,
          ...(pricing === "custom_quote" ? {} : { priceMinor }),
        };
        try {
          if (service)
            await update.mutateAsync({ id: service.id, values: body });
          else {
            await create.mutateAsync({
              ...body,
              categoryId: String(values.get("categoryId")),
              currency: "NGN",
            });
            form.reset();
          }
        } catch {
          /* Error below. */
        }
      }}
    >
      <h3>{service ? "Edit service" : "Add a service"}</h3>
      <label className="field">
        Category
        <select
          name="categoryId"
          required
          disabled={!!service || categories.isPending || categories.isError}
          defaultValue={service?.categoryId ?? ""}
        >
          <option value="" disabled>
            Select category
          </option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {categories.isError && (
        <p role="alert">{errorMessage(categories.error)}</p>
      )}
      <label className="field">
        Service name
        <input
          name="title"
          required
          minLength={3}
          defaultValue={service?.title}
        />
      </label>
      <label className="field">
        What is included?
        <textarea
          name="description"
          required
          minLength={30}
          rows={5}
          defaultValue={service?.description}
        />
      </label>
      <label className="field">
        Pricing
        <select
          value={pricing}
          onChange={(e) => setPricing(e.target.value as PricingType)}
        >
          {Object.entries({
            fixed: "Fixed price",
            starting_from: "Starting from",
            per_hour: "Per hour",
            per_session: "Per session",
            custom_quote: "Custom quote",
          }).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {pricing !== "custom_quote" && (
        <label className="field">
          Price (₦)
          <input
            name="price"
            type="number"
            min="0.01"
            step="0.01"
            required
            defaultValue={service?.priceMinor ? service.priceMinor / 100 : ""}
          />
        </label>
      )}
      {fieldError && <p role="alert">{fieldError}</p>}
      {mutation.isError && <p role="alert">{errorMessage(mutation.error)}</p>}
      <Button
        type="submit"
        disabled={
          mutation.isPending ||
          (!service && (!categories.data?.length || categories.isPending))
        }
      >
        {mutation.isPending
          ? "Saving…"
          : service
            ? "Save service"
            : "Save draft service"}
      </Button>
    </form>
  );
}
