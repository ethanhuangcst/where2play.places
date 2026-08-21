import { Suspense } from "react";
import SetPasswordPageClient from "@/src/ui/set-password-page";

export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordPageClient />
    </Suspense>
  );
}
