import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { VerifyForm } from "./verify-form";

export default async function VerifyPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  // Landing here without a pending sign-in means the interstitial expired or
  // the page was opened directly.
  const store = await cookies();
  if (!store.get("fd_2fa_pending")) redirect("/login");

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <VerifyForm />
    </main>
  );
}
