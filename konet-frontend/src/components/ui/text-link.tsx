import Link from "next/link";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Link> & {
  tone?: "default" | "muted";
};

export function TextLink({ className = "", tone = "default", ...props }: Props) {
  return (
    <Link
      {...props}
      className={`text-link-action text-link-action-${tone} ${className}`.trim()}
    />
  );
}
