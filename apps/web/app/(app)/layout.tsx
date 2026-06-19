import Image from "next/image";
import Link from "next/link";
import { AuthGate } from "@/components/auth-gate";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { Topbar } from "@/components/app/topbar";
import { WorkspaceSwitcher } from "@/components/app/workspace-switcher";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link href="/dashboard" className="sidebar-brand" aria-label="Sales AI dashboard">
          <Image src="/brand/brand-mark.svg" alt="Sales AI" width={28} height={28} />
          <span className="sidebar-brand-name">Sales AI</span>
        </Link>
        <WorkspaceSwitcher />
        <SidebarNav />
      </aside>

      <div className="app-body">
        <AuthGate>
          <Topbar />
          <main className="app-content">{children}</main>
        </AuthGate>
      </div>
    </div>
  );
}
