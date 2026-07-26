import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
  type LinkTokenCreateRequest,
} from "plaid";
import { createLocalJWKSet, jwtVerify, decodeProtectedHeader, type JSONWebKeySet } from "jose";
import { env, type PlaidEnv } from "@/lib/env";

/**
 * One client per Plaid environment.
 *
 * The app serves both at once: real accounts against production and the demo
 * account against sandbox. An access token is only valid against the
 * environment that issued it, so every call has to be routed to the matching
 * client — hence `plaidFor(environment)` rather than a single shared instance.
 */
function clientFor(environment: PlaidEnv): PlaidApi {
  const secret =
    environment === "production" ? env.PLAID_PRODUCTION_SECRET : env.PLAID_SANDBOX_SECRET;

  if (!secret) {
    throw new Error(`No Plaid secret configured for the ${environment} environment`);
  }

  return new PlaidApi(
    new Configuration({
      basePath: PlaidEnvironments[environment],
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": env.PLAID_CLIENT_ID,
          "PLAID-SECRET": secret,
          "Plaid-Version": "2020-09-14",
        },
      },
    }),
  );
}

const clients = new Map<PlaidEnv, PlaidApi>();

export function plaidFor(environment: PlaidEnv): PlaidApi {
  let client = clients.get(environment);
  if (!client) {
    client = clientFor(environment);
    clients.set(environment, client);
  }
  return client;
}

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
export async function createLinkToken(
  userId: string,
  environment: PlaidEnv,
): Promise<string> {
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

  const { data } = await plaidFor(environment).linkTokenCreate(request);
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
  environment: PlaidEnv,
): Promise<string> {
  const { data } = await plaidFor(environment).linkTokenCreate({
    user: { client_user_id: userId },
    client_name: "Finance Dashboard",
    country_codes: COUNTRY_CODES,
    language: "en",
    access_token: accessToken,
  });
  return data.link_token;
}

/** Trade the browser's short-lived public token for the long-lived access token. */
export async function exchangePublicToken(publicToken: string, environment: PlaidEnv) {
  const { data } = await plaidFor(environment).itemPublicTokenExchange({
    public_token: publicToken,
  });
  return { accessToken: data.access_token, itemId: data.item_id };
}

export async function getInstitution(institutionId: string, environment: PlaidEnv) {
  try {
    const { data } = await plaidFor(environment).institutionsGetById({
      institution_id: institutionId,
      country_codes: COUNTRY_CODES,
    });
    return data.institution;
  } catch {
    // Institution metadata is cosmetic — a failure here should never block a link.
    return null;
  }
}

export async function removeItem(accessToken: string, environment: PlaidEnv): Promise<void> {
  await plaidFor(environment).itemRemove({ access_token: accessToken });
}

// ─── Webhook verification ────────────────────────────────────────────────────

/** Keyed by `${environment}:${kid}` — verification keys do not cross environments. */
const jwksCache = new Map<string, ReturnType<typeof createLocalJWKSet>>();
/** Key ids Plaid rejected — cached so a repeat costs no outbound call. */
const jwksFailures = new Set<string>();

/** Environments this deployment is actually configured to talk to. */
function configuredEnvironments(): PlaidEnv[] {
  const list: PlaidEnv[] = ["sandbox"];
  if (env.PLAID_PRODUCTION_SECRET) list.push("production");
  return list;
}

/**
 * Verify that a webhook genuinely came from Plaid, and report which environment
 * signed it.
 *
 * Both environments send webhooks to the same public URL, and the body cannot be
 * trusted before the signature is checked — so the environment is discovered by
 * trying each configured one rather than by reading the unverified payload.
 */
export async function verifyWebhook(
  body: string,
  verificationHeader: string,
): Promise<PlaidEnv | null> {
  for (const environment of configuredEnvironments()) {
    if (await verifyAgainst(body, verificationHeader, environment)) return environment;
  }
  return null;
}

async function verifyAgainst(
  body: string,
  verificationHeader: string,
  environment: PlaidEnv,
): Promise<boolean> {
  try {
    const { kid } = decodeProtectedHeader(verificationHeader);
    if (!kid) return false;

    const cacheKey = `${environment}:${kid}`;

    /**
     * `kid` is attacker-controlled — it is read from an unverified JWT header,
     * necessarily so, since it selects the key used to verify it. Constraining
     * the shape before any network call stops a flood of junk key ids from
     * turning this public endpoint into an amplifier against Plaid's API, which
     * would exhaust the rate limit that real syncs depend on.
     */
    if (!/^[a-f0-9-]{16,64}$/i.test(kid)) return false;

    // Remember failures too, so a repeated bogus kid costs one call, not N.
    if (jwksFailures.has(cacheKey)) return false;

    let jwks = jwksCache.get(cacheKey);

    if (!jwks) {
      const { data } = await plaidFor(environment)
        .webhookVerificationKeyGet({ key_id: kid })
        .catch((error: unknown) => {
          jwksFailures.add(cacheKey);
          throw error;
        });

      // A key Plaid has retired must not keep verifying signatures forever.
      if (data.key.expired_at) return false;

      jwks = createLocalJWKSet({ keys: [data.key as unknown] } as JSONWebKeySet);
      jwksCache.set(cacheKey, jwks);
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
