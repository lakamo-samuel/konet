import Link from "next/link";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

type ButtonVariant = "primary" | "secondary" | "quiet" | "dark" | "danger";
type SharedProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
};

type NativeButtonProps = SharedProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: never };
type ButtonLinkProps = SharedProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
  };

export type ButtonProps = NativeButtonProps | ButtonLinkProps;

function classes(variant: ButtonVariant, className = "") {
  return ["button", variant, className].filter(Boolean).join(" ");
}

export function Button(props: ButtonProps) {
  if ("href" in props && props.href) {
    const { href, variant = "primary", className, children, ...linkProps } =
      props;
    return (
      <Link className={classes(variant, className)} href={href} {...linkProps}>
        {children}
      </Link>
    );
  }

  const {
    variant = "primary",
    className,
    children,
    type = "button",
    ...buttonProps
  } = props as NativeButtonProps;

  return (
    <button
      className={classes(variant, className)}
      type={type}
      {...buttonProps}
    >
      {children}
    </button>
  );
}
