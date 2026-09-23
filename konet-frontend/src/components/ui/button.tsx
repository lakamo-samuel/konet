import Link from "next/link";import type {ButtonHTMLAttributes,ReactNode} from "react";
type Props={children:ReactNode;variant?:"primary"|"secondary"|"quiet"|"dark";href?:string;className?:string}&ButtonHTMLAttributes<HTMLButtonElement>;
export function Button({children,variant="primary",href,className="",...props}:Props){const classes=`button ${variant} ${className}`;return href?<Link className={classes} href={href}>{children}</Link>:<button className={classes} {...props}>{children}</button>}
