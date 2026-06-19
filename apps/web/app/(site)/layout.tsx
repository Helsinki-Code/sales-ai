import Image from "next/image";
import Link from "next/link";

const navLinks = [
  { href: "/product",  label: "Product"  },
  { href: "/pricing",  label: "Pricing"  },
  { href: "/security", label: "Security" },
  { href: "/blog",     label: "Blog"     },
  { href: "/docs",     label: "Docs"     },
];

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="site-nav">
        <Link href="/" className="brand-lockup" aria-label="Sales AI home">
          <Image
            src="/brand/brand-mark.svg"
            alt="Sales AI"
            width={26}
            height={26}
            priority
          />
          <span className="brand-wordmark">Sales AI</span>
        </Link>

        <nav className="nav-links" aria-label="Primary navigation">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <Link href="/docs/quickstart" className="text-link">
            Quickstart
          </Link>
          <Link href="/login" className="btn btn-primary" style={{ fontSize: "0.8125rem", padding: "0.5rem 1rem" }}>
            Get Started
          </Link>
        </div>
      </header>

      {children}

      <footer className="site-footer">
        <div className="container footer-inner">
          <span>© {new Date().getFullYear()} Sales AI — BYOK sales platform for developers.</span>
          <div className="footer-links">
            <Link href="/security">Security</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/docs">Docs</Link>
            <Link href="/blog">Blog</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
