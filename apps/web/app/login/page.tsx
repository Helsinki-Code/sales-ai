"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient() as any;
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("idle");
    const nextPath = searchParams.get("redirect") ?? "/dashboard";

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}` }
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage("Check your email for the sign-in link.");
  }

  return (
    <main className="container main-section">
      <h1 className="page-title">Sign In</h1>
      <form className="card" onSubmit={onSubmit}>
        <label htmlFor="email">Work email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          style={{ display: "block", marginTop: "0.5rem", marginBottom: "1rem", width: "100%", padding: "0.7rem" }}
        />
        <button className="cta" type="submit">Send magic link</button>
        {status !== "idle" ? <p style={{ marginTop: "0.8rem" }}>{message}</p> : null}
      </form>
    </main>
  );
}
