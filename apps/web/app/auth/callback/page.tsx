import { Suspense } from "react";
import AuthCallbackContent from "./content";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div>Finalizing sign in...</div>}>
      <AuthCallbackContent />
    </Suspense>
  );
}
