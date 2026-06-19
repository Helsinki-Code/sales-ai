import type { HTMLAttributes } from "react";
export function Tabs({ className="", ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={`ui-tabs ${className}`.trim()} {...props} />; }
