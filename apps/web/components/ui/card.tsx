import type { HTMLAttributes } from "react";
export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={`ui-card ${className}`.trim()} {...props} />; }
export function CardHeader({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={`ui-card-header ${className}`.trim()} {...props} />; }
export function CardTitle({ className = "", ...props }: HTMLAttributes<HTMLHeadingElement>) { return <h3 className={`ui-card-title ${className}`.trim()} {...props} />; }
