import Link from "next/link";
import { AuthGate } from "@/components/auth-gate";

const appLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/reference", label: "API Reference" },
  { href: "/keys", label: "API Keys" },
  { href: "/playground", label: "Playground" },
  { href: "/usage", label: "Usage" },
  { href: "/settings", label: "Settings" }
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="panel-layout">
      <aside className="sidebar">
        <div className="brand">Sales AI</div>
        <nav>
          {appLinks.map((link) => (
            <Link href={link.href} key={link.href}>{link.label}</Link>
          ))}
        </nav>
      </aside>
      <section className="dashboard-main">
        <AuthGate>{children}</AuthGate>
      </section>
    </div>
  );
}
