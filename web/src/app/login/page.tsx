import Link from "next/link";
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
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <AuthForm firstRun={firstRun} googleEnabled={googleEnabled} errorCode={params.error} />

      {/* Reachable without a session — Plaid's diligence asks for a public
          privacy policy URL, and a bank reviewing the connection should find it. */}
      <footer className="mt-10">
        <Link
          href="/privacy"
          className="text-[0.75rem] text-[var(--ink-muted)] hover:text-[var(--ink-secondary)] hover:underline"
        >
          Privacy Policy
        </Link>
      </footer>
    </main>
  );
}
