import type { ReactNode } from "react";
import Icon from "./icon";

type EmptyStateProps = {
  icon?: string;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon = "search",
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <section className={`empty-state ${className}`.trim()}>
      <span className="empty-icon">
        <Icon name={icon} size={28} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  );
}
