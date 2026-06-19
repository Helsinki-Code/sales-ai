import Link from "next/link";

export function Topbar() {
  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <span className="topbar-eyebrow">Workspace</span>
        <strong className="topbar-title">Sales AI Control Center</strong>
      </div>

      <div className="topbar-search" role="search" aria-label="Search">
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span>Search jobs, leads, docs…</span>
        <span className="search-kbd">⌘K</span>
      </div>

      <div className="topbar-actions">
        <div className="unit-pill">
          <span className="unit-pill-dot" aria-hidden="true" />
          Lead units ready
        </div>
        <Link href="/settings" className="avatar-button">
          Account
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" />
          </svg>
        </Link>
      </div>
    </header>
  );
}
