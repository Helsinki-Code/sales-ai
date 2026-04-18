import { redirect } from "next/navigation";

export default async function CallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const code = params.code;
  const state = params.state;
  const error = params.error;

  if (error) {
    redirect(`/auth/callback?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(params.error_description || "")}&state=${encodeURIComponent(state || "")}`);
  }

  if (code) {
    redirect(`/auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state || "")}`);
  }

  redirect("/login");
}
