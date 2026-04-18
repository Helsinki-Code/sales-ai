import Link from "next/link";

const links = [
  { href: "/product", label: "Product" },
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "Security" },
  { href: "/docs", label: "Docs" },
  { href: "/dashboard", label: "Dashboard" }
];

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="container site-nav">
        <Link href="/" className="brand">Sales AI</Link>
        <nav className="nav-links" aria-label="Primary navigation">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>{link.label}</Link>
          ))}
        </nav>
        <Link href="/dashboard" className="cta">Open App</Link>
      </header>
      {children}
      <footer>
        <div className="container">Production-ready BYOK sales platform on Render + Vercel + Supabase.</div>
      </footer>
    </>
  );
}
