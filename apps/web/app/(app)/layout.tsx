import { AuthGate } from "@/components/auth-gate";
import { SidebarNav } from "@/components/app/sidebar-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="panel-layout">
      <aside className="sidebar">
        <div className="brand">Sales AI</div>
        <SidebarNav />
      </aside>
      <section className="dashboard-main">
        <AuthGate>{children}</AuthGate>
      </section>
    </div>
  );
}
