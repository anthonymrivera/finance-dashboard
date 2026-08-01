/**
 * Link-token persistence across the OAuth redirect.
 *
 * Linking an OAuth institution (Chase, Bank of America, most majors) can leave
 * this app entirely — full-page redirect to the bank's consent screen, then
 * back to /plaid-oauth. React state does not survive that trip, and Plaid
 * requires resuming with the *same* link token the session started with, so the
 * token is parked in localStorage for the duration.
 *
 * A link token is a short-lived (4h) credential that can only open Link for
 * this user — it cannot read data — so localStorage is an acceptable home.
 * try/catch throughout: storage can be unavailable (private browsing), and a
 * failed save should degrade to non-OAuth linking still working, not throw.
 */
const KEY = "plaid_link_token";

export function saveLinkToken(token: string): void {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    // Non-OAuth institutions still link fine without persistence.
  }
}

export function readLinkToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearLinkToken(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Worst case a stale token lingers until it expires in four hours.
  }
}
