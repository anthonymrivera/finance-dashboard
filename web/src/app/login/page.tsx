import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isFirstRun } from "@/lib/auth/invites";
import { googleEnabled } from "@/lib/env";
import { AuthForm } from "./auth-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getCurrentUser()) redirect("/dashboard");

  const [firstRun, params] = await Promise.all([isFirstRun(), searchParams]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <AuthForm firstRun={firstRun} googleEnabled={googleEnabled} errorCode={params.error} />
    </main>
  );
}
