import { redirect } from "next/navigation";
import { readSession } from "@/src/auth/session";
import { prisma } from "@/src/db/client";
import { AppShell } from "@/src/ui/app-shell";
import { AppHeader } from "@/src/ui/app-header";
import { FamilyFooter } from "@/src/ui/family-footer";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true },
  });
  // Cookie may still verify after the user row was deleted (e.g. test wipe).
  // Do not clearSession here — cookies() cannot be modified in a layout.
  if (!user) redirect("/login");

  return (
    <AppShell>
      <AppHeader />
      {children}
      <FamilyFooter variant="app" />
    </AppShell>
  );
}
