import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — AMR Finance",
  description: "How this application handles financial data.",
};

/**
 * Public page — deliberately outside the (app) group, so it is readable without
 * a session. Plaid's diligence asks for a privacy policy URL, and a bank
 * reviewing the connection should be able to reach it.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/login"
        className="text-[0.8125rem] text-[var(--accent)] hover:underline"
      >
        ← Back to sign in
      </Link>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-[0.875rem] text-[var(--ink-secondary)]">
        Last updated 25 July 2026
      </p>

      <div className="mt-10 space-y-8 text-[0.9375rem] leading-relaxed">
        <Section title="What this is">
          <p>
            AMR Finance is a personal finance dashboard operated by one person for
            their own accounts. It is not a commercial service and has no
            customers. Only email addresses on a fixed allowlist, set in
            deployment configuration, can create an account or sign in.
          </p>
        </Section>

        <Section title="What is collected">
          <p>
            When you connect a financial institution, Plaid returns account
            balances, transaction history, investment holdings, and loan detail
            such as interest rates and payment due dates. That data is stored so
            the dashboard can display it.
          </p>
          <p>
            An email address is stored for sign-in, along with a password hash if
            a password is set, or a Google account identifier if Google sign-in is
            used.
          </p>
        </Section>

        <Section title="Bank credentials are never seen by this application">
          <p>
            Bank usernames and passwords are entered into Plaid&rsquo;s own secure
            interface, which runs inside this page but is operated by Plaid. Those
            credentials are never transmitted to, processed by, or stored by this
            application.
          </p>
          <p>
            What this application receives is an access token, which permits
            reading account data and nothing else. It cannot move money, initiate
            a payment, or change anything at the institution.
          </p>
        </Section>

        <Section title="How data is protected">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Plaid access tokens and two-factor secrets are encrypted with
              AES-256-GCM before being written to the database.
            </li>
            <li>All traffic uses TLS 1.2 or better. TLS 1.0 and 1.1 are refused.</li>
            <li>Passwords, where set, are hashed with Argon2id.</li>
            <li>
              Sessions live in httpOnly cookies and can be revoked immediately;
              the database stores only a hash of each session token.
            </li>
            <li>Two-factor authentication is available and codes are single-use.</li>
          </ul>
        </Section>

        <Section title="What is not done">
          <p>
            No data is sold, shared, or disclosed to anyone. There is no
            analytics, advertising, or tracking of any kind. No third party has
            access to the database. The application is not indexed by search
            engines.
          </p>
        </Section>

        <Section title="Retention and deletion">
          <p>
            Data is kept only while an institution remains linked. Unlinking
            revokes the access token at Plaid and permanently deletes every
            account, transaction, and holding associated with it. Deleting the
            user account removes everything belonging to it. Deletion is immediate
            and cannot be undone.
          </p>
          <p>
            Sessions expire after 30 days and are purged daily by a scheduled job.
          </p>
        </Section>

        <Section title="Your bank">
          <p>
            You can revoke this application&rsquo;s access at any time — from
            within the app by unlinking, through{" "}
            <a
              href="https://my.plaid.com"
              className="text-[var(--accent)] hover:underline"
              rel="noreferrer noopener"
              target="_blank"
            >
              Plaid Portal
            </a>
            , or directly through your bank&rsquo;s connected-apps settings.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about data handling:{" "}
            <a href="mailto:arivera1995@gmail.com" className="text-[var(--accent)] hover:underline">
              arivera1995@gmail.com
            </a>
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[1.0625rem] font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
