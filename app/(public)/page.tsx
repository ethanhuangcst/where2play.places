import { readSession } from "@/src/auth/session";
import HomePageClient from "@/src/ui/home-page";

export default async function HomePage() {
  const session = await readSession();
  return <HomePageClient signedIn={Boolean(session)} />;
}
