import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };
export function Button({ variant = "primary", className = "", ...props }: Props) { return <button className={`ui-button ui-button-${variant} ${className}`.trim()} {...props} />; }
export function ButtonLink({ variant = "primary", className = "", children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; children: ReactNode }) { return <a className={`ui-button ui-button-${variant} ${className}`.trim()} {...props}>{children}</a>; }
