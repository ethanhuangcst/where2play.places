import { Suspense } from "react";
import ProfilePageClient from "@/src/ui/profile-page";

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfilePageClient />
    </Suspense>
  );
}
