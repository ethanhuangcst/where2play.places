import { redirect } from "next/navigation";
import { readSession } from "@/src/auth/session";
import { AppShell } from "@/src/ui/app-shell";
import { AppHeader } from "@/src/ui/app-header";
import { FamilyFooter } from "@/src/ui/family-footer";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect("/login");
  return (
    <AppShell>
      <AppHeader />
      {children}
      <FamilyFooter variant="app" />
    </AppShell>
  );
}
