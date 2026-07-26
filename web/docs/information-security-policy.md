# Information Security Policy

- **Application:** AMR Finance — personal finance dashboard
- **Owner:** Anthony Rivera, sole developer and operator
- **Contact:** arivera1995@gmail.com
- **Effective:** 25 July 2026
- **Review cadence:** Annually, and on any material change to the architecture

---

## 1. Context and scope

This policy describes the security controls operating on a single-operator
personal finance dashboard. There is one user, who is also the developer and
administrator. There are no employees, contractors, or third-party processors,
and the application has no customers.

Several controls a larger organisation would need are therefore not applicable
rather than missing: employee onboarding and offboarding, shared-account
governance, and segregation of duties among staff. Where that is the case this
policy says so plainly rather than claiming a control that does not exist.

## 2. Identity and access management

**Application access.** Sign-in is by Google OAuth 2.0 with PKCE, or by email and
password. An allowlist of permitted email addresses is held in deployment
configuration and enforced at every authentication path *and* on every
subsequent request, so removing an address revokes access on its next request
rather than at session expiry. Registration is closed: no new account can be
created outside that allowlist.

**Second factor.** Time-based one-time passwords (TOTP, RFC 6238) are supported.
Codes are single-use — the accepted time step is recorded and refused
thereafter — and failed attempts are counted in the database with lockout, so
the limit holds across serverless instances rather than resetting per process.
Disabling the second factor, or enrolling a new device, requires a current code.

**Administrative access.** Hosting (Vercel), database (Neon), source control
(GitHub), and the Plaid dashboard are each accessed through an individual
account secured with multi-factor authentication. No shared credentials exist.

**Authorization.** Every database query is scoped by the authenticated user's
identifier. This was verified across all query sites during a pre-launch review.

## 3. Data protection

**In transit.** TLS 1.2 and 1.3 only; TLS 1.0 and 1.1 are refused at the edge.
HTTP Strict Transport Security is sent with a two-year max-age and
`includeSubDomains`. Database connections require TLS.

**At rest.** Plaid access tokens and TOTP secrets are encrypted with AES-256-GCM
using a 32-byte key held only in deployment configuration, with a random 96-bit
IV per record and authenticated decryption. Passwords are hashed with Argon2id
(19 MiB, 2 iterations). Session tokens are stored as SHA-256 digests. The
database provider encrypts storage.

**Secrets.** All credentials live in deployment environment variables. The source
repository has never contained a secret, verified by scanning the full commit
history for every live credential value.

## 4. Application security

- Security headers on every response: HSTS, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and a `Permissions-Policy`
  denying camera, microphone, geolocation, payment, and USB.
- Rate limiting on authentication and on data-refresh endpoints.
- Sign-in failures are indistinguishable in both message and timing, so the form
  cannot be used to enumerate registered addresses.
- Webhooks from Plaid are verified by ES256 signature *and* a hash of the raw
  request body, rejected outside a five-minute window, and required to originate
  from the same Plaid environment as the item they target.
- Error logging is allow-listed: only known-safe fields are recorded, so
  credentials cannot reach the logs through an exception object.
- Parameterised queries throughout; no user input is interpolated into SQL.

## 5. Vulnerability management

Dependencies are scanned with `npm audit` before each deployment; production
dependencies currently report zero known vulnerabilities. Automated dependency
update alerts are enabled on the source repository. Patches to the framework and
to transitive dependencies with published advisories are applied promptly — two
such advisories were remediated during pre-launch review.

Operator devices run a supported operating system with automatic security
updates and full-disk encryption enabled.

Formal penetration testing and static or dynamic application security testing
are **not** performed. The application underwent a structured pre-launch security
review covering authentication, authorization, cryptography, injection, and
secrets handling; findings were remediated before deployment.

## 6. Logging and monitoring

Application and platform logs are retained by the hosting provider. Rejected
webhooks, refused sign-ins from non-allowlisted addresses, and synchronisation
failures are logged. Given a single user, monitoring is by direct inspection
rather than an alerting pipeline.

## 7. Incident response

As a single-operator application, incident response is:

1. Revoke access — invalidate all sessions, and unlink affected institutions,
   which revokes the access token at Plaid.
2. Rotate the affected credential (encryption key, database credential, Plaid
   secret, or OAuth secret) in deployment configuration and redeploy.
3. Determine what data was reachable and over what period.
4. Notify Plaid, and any affected institution, as required.

Because the only data subject is the operator, third-party breach notification
obligations do not arise.

## 8. Business continuity

The database provider maintains automated backups with point-in-time recovery.
Application code is version-controlled and redeployable from source in minutes.
The encryption key is backed up separately from the deployment configuration;
losing it would render stored access tokens undecryptable and require relinking
every institution, which is the documented recovery path.

## 9. Review

This policy is reviewed annually and on any material change to the architecture,
the data stored, or the third parties involved. It is kept in the application's
source repository alongside the code it describes.
