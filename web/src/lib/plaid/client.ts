import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
  type LinkTokenCreateRequest,
} from "plaid";
import { createLocalJWKSet, jwtVerify, decodeProtectedHeader, type JSONWebKeySet } from "jose";
import { env } from "@/lib/env";

const configuration = new Configuration({
  basePath: PlaidEnvironments[env.PLAID_ENV],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": env.PLAID_CLIENT_ID,
      "PLAID-SECRET": env.PLAID_SECRET,
      "Plaid-Version": "2020-09-14",
    },
  },
});

export const plaid = new PlaidApi(configuration);

/**
 * Products requested at link time.
 *
 * Adding one later does NOT apply to Items already linked — every institution
 * has to be reconnected — so the full set is requested up front:
 *
 *   Transactions — balances and history for depository and credit accounts
 *   Investments  — holdings and positions for brokerage and retirement accounts
 *   Liabilities  — APR, minimum payment, due dates for cards, loans, mortgages
 *
 * The cost of the wider scope is a longer Plaid security review and a slightly
 * heavier consent screen at link time.
 */
const PRODUCTS: Products[] = [Products.Transactions, Products.Investments, Products.Liabilities];
const COUNTRY_CODES: CountryCode[] = [CountryCode.Us];

/**
 * A Link token is a short-lived (4 hour) credential that authorizes one Link
 * session in the browser. It is not sensitive in the way an access token is —
 * it cannot read anything on its own.
 */
export async function createLinkToken(userId: string): Promise<string> {
  const request: LinkTokenCreateRequest = {
    user: { client_user_id: userId },
    client_name: "Finance Dashboard",
    products: PRODUCTS,
    country_codes: COUNTRY_CODES,
    language: "en",
  };

  // Plaid rejects localhost webhook URLs, so only register one when the app is
  // deployed somewhere publicly reachable.
  if (env.APP_URL.startsWith("https://")) {
    request.webhook = `${env.APP_URL}/api/plaid/webhook`;
  }

  const { data } = await plaid.linkTokenCreate(request);
  return data.link_token;
}

/**
 * Re-authentication for an Item whose login has broken. Passing an access token
 * with no products puts Link into update mode, which repairs the existing Item
 * rather than creating a duplicate one.
 */
export async function createUpdateModeLinkToken(
  userId: string,
  accessToken: string,
): Promise<string> {
  const { data } = await plaid.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: "Finance Dashboard",
    country_codes: COUNTRY_CODES,
    language: "en",
    access_token: accessToken,
  });
  return data.link_token;
}

/** Trade the browser's short-lived public token for the long-lived access token. */
export async function exchangePublicToken(publicToken: string) {
  const { data } = await plaid.itemPublicTokenExchange({ public_token: publicToken });
  return { accessToken: data.access_token, itemId: data.item_id };
}

export async function getInstitution(institutionId: string) {
  try {
    const { data } = await plaid.institutionsGetById({
      institution_id: institutionId,
      country_codes: COUNTRY_CODES,
    });
    return data.institution;
  } catch {
    // Institution metadata is cosmetic — a failure here should never block a link.
    return null;
  }
}

export async function removeItem(accessToken: string): Promise<void> {
  await plaid.itemRemove({ access_token: accessToken });
}

// ─── Webhook verification ────────────────────────────────────────────────────

const jwksCache = new Map<string, ReturnType<typeof createLocalJWKSet>>();
/** Key ids Plaid rejected — cached so a repeat costs no outbound call. */
const jwksFailures = new Set<string>();

/**
 * Verify that a webhook genuinely came from Plaid.
 *
 * The endpoint is public and unauthenticated, so without this check anyone who
 * learns the URL could forge sync notifications. Plaid signs each request with
 * an ES256 JWT in `Plaid-Verification`, whose payload carries a SHA-256 of the
 * raw body — so the body must be compared too, not just the signature.
 */
export async function verifyWebhook(body: string, verificationHeader: string): Promise<boolean> {
  try {
    const { kid } = decodeProtectedHeader(verificationHeader);
    if (!kid) return false;

    /**
     * `kid` is attacker-controlled — it is read from an unverified JWT header,
     * necessarily so, since it selects the key used to verify it. Constraining
     * the shape before any network call stops a flood of junk key ids from
     * turning this public endpoint into an amplifier against Plaid's API, which
     * would exhaust the rate limit that real syncs depend on.
     */
    if (!/^[a-f0-9-]{16,64}$/i.test(kid)) return false;

    // Remember failures too, so a repeated bogus kid costs one call, not N.
    if (jwksFailures.has(kid)) return false;

    let jwks = jwksCache.get(kid);

    if (!jwks) {
      const { data } = await plaid
        .webhookVerificationKeyGet({ key_id: kid })
        .catch((error: unknown) => {
          jwksFailures.add(kid);
          throw error;
        });

      // A key Plaid has retired must not keep verifying signatures forever.
      if (data.key.expired_at) return false;

      jwks = createLocalJWKSet({ keys: [data.key as unknown] } as JSONWebKeySet);
      jwksCache.set(kid, jwks);
    }

    const { payload } = await jwtVerify(verificationHeader, jwks, { algorithms: ["ES256"] });

    // Reject anything older than five minutes to bound replay attacks.
    const issuedAt = (payload.iat ?? 0) * 1000;
    if (Date.now() - issuedAt > 5 * 60 * 1000) return false;

    const { createHash, timingSafeEqual } = await import("node:crypto");
    const actual = createHash("sha256").update(body, "utf8").digest("hex");
    const expected = payload.request_body_sha256;

    if (typeof expected !== "string" || expected.length !== actual.length) return false;

    return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  } catch {
    return false;
  }
}
