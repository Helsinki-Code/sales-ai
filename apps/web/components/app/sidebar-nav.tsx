"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

const appLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/reference", label: "API Reference" },
  { href: "/keys", label: "API Keys" },
  { href: "/playground", label: "Playground" },
  { href: "/usage", label: "Usage" },
  { href: "/billing", label: "Billing" },
  { href: "/settings", label: "Settings" }
];

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <nav className="sidebar-nav">
        {appLinks.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link key={link.href} href={link.href} className={isActive ? "active" : undefined}>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={handleLogout}
        className="sidebar-logout"
        disabled={isLoggingOut}
      >
        {isLoggingOut ? "Logging out..." : "Logout"}
      </button>
    </>
  );
}
