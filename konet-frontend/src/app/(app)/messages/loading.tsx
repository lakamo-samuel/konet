import { WorkspaceSkeleton } from "@/components/ui/workspace-skeleton";

export default function Loading() {
  return (
    <section className="content-width app-section messages-page" aria-busy="true">
      <div className="page-heading">
        <div className="skeleton eyebrow-skeleton" aria-hidden="true" />
        <div className="skeleton heading-skeleton" aria-hidden="true" />
        <div className="skeleton message-subtitle-skeleton" aria-hidden="true" />
      </div>
      <WorkspaceSkeleton variant="messages" count={4} />
    </section>
  );
}
