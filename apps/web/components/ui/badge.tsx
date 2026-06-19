import type { HTMLAttributes } from "react";
type Variant = "neutral" | "success" | "warning" | "danger" | "accent";
export function Badge({ variant = "neutral", className = "", ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) { return <span className={`ui-badge ui-badge-${variant} ${className}`.trim()} {...props} />; }
