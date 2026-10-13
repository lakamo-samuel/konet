type Variant = "requests" | "jobs" | "messages";

const labels: Record<Variant, string> = {
  requests: "Loading service requests",
  jobs: "Loading jobs",
  messages: "Loading conversations",
};

export function WorkspaceSkeleton({
  variant,
  count = 3,
}: {
  variant: Variant;
  count?: number;
}) {
  return (
    <div
      className={`workspace-skeleton workspace-skeleton-${variant}`}
      role="status"
      aria-label={labels[variant]}
      aria-busy="true"
    >
      {variant === "messages" && <div className="skeleton inbox-title-skeleton" />}
      {Array.from({ length: count }, (_, index) => (
        <article className="skeleton-record" key={index} aria-hidden="true">
          {variant === "messages" && <div className="skeleton inbox-avatar-skeleton" />}
          <div className="skeleton-record-copy">
            <div className="skeleton skeleton-line skeleton-line-title" />
            <div className="skeleton skeleton-line skeleton-line-meta" />
          </div>
          {variant !== "messages" && <div className="skeleton skeleton-action" />}
        </article>
      ))}
    </div>
  );
}
