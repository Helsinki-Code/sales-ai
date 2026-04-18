import { Suspense } from "react";
import OAuthConsentContent from "./content";

export default function OAuthConsentPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OAuthConsentContent />
    </Suspense>
  );
}
