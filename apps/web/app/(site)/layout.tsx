import Image from "next/image";
import Link from "next/link";

const links = [
  { href: "/product", label: "Product" },
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "Security" },
  { href: "/blog", label: "Blog" },
  { href: "/docs", label: "Docs" },
];

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="container site-nav">
        <Link href="/" className="brand-lockup" aria-label="Sales AI home">
          <Image
            src="/brand/brand-mark.svg"
            alt="Sales AI brand mark logo"
            width={36}
            height={36}
            priority
          />
          <span className="brand-wordmark">Sales AI</span>
        </Link>

        <nav className="nav-links" aria-label="Primary navigation">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <Link href="/docs/quickstart" className="text-link">
            Quickstart
          </Link>
          <Link href="/login" className="cta">
            Connect Your Key
          </Link>
        </div>
      </header>
      {children}
      <footer className="site-footer">
        <div className="container footer-inner">
          <div>Sales AI - BYOK sales automation platform for teams that build.</div>
          <div className="footer-links">
            <Link href="/security">Security</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/docs">Docs</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
