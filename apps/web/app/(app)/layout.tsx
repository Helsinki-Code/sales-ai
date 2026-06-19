import Image from "next/image";
import Link from "next/link";
import { AuthGate } from "@/components/auth-gate";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { Topbar } from "@/components/app/topbar";
import { WorkspaceSwitcher } from "@/components/app/workspace-switcher";
export default function AppLayout({ children }: { children: React.ReactNode }) { return <div className="panel-layout"><aside className="sidebar"><Link href="/dashboard" className="brand-lockup" aria-label="Sales AI dashboard home"><Image src="/brand/brand-mark.svg" alt="Sales AI brand mark" width={32} height={32} /><span className="brand-wordmark">Sales AI</span></Link><WorkspaceSwitcher /><SidebarNav /></aside><section className="dashboard-main"><AuthGate><Topbar />{children}</AuthGate></section></div>; }
