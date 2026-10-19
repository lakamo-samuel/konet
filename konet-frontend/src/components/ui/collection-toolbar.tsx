import type { ReactNode } from "react";

export function CollectionToolbar({
  children,
  actions,
}: {
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="collection-toolbar">
      <div className="collection-filters">{children}</div>
      {actions && <div className="collection-actions">{actions}</div>}
    </div>
  );
}
