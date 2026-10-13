import { WorkspaceSkeleton } from "@/components/ui/workspace-skeleton";

export default function Loading() {
  return (
    <section className="workspace-page" aria-busy="true">
      <div className="skeleton heading-skeleton" aria-hidden="true" />
      <div className="skeleton job-action-skeleton" aria-hidden="true" />
      <WorkspaceSkeleton variant="jobs" />
    </section>
  );
}
