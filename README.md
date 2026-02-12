# authkit-oidc-generic

A side-by-side comparison of authenticating with WorkOS using a generic OIDC client library vs. the WorkOS SDK.

## What this demonstrates

WorkOS exposes an OIDC discovery document for the environment client ID at:

```
GET /user_management/{client_id}/.well-known/openid-configuration
```

This returns:

```json
{
  "issuer": "https://api.workos.com/user_management/{client_id}",
  "authorization_endpoint": "https://api.workos.com/user_management/authorize",
  "token_endpoint": "https://api.workos.com/user_management/authenticate",
  "response_types_supported": ["code"],
  "jwks_uri": "https://api.workos.com/sso/jwks/{client_id}"
}
```

### Generic OIDC client (`src/generic-oidc.ts`)

Uses [openid-client](https://github.com/panva/openid-client) to test each step of the standard OIDC flow:

1. **Discovery** -- Fetches `.well-known/openid-configuration`. Works.
2. **Authorization** -- Builds a standard OAuth2 authorize URL with PKCE and redirects to AuthKit. Works.
3. **Token exchange** -- This is where generic OIDC clients break:
   - The token endpoint expects a **JSON** request body (generic clients send `application/x-www-form-urlencoded` per spec)
   - The response is a **WorkOS-proprietary format** (includes `user`, `authentication_method`, etc.) and is missing `token_type`, which the OAuth2 spec requires

The token exchange is done manually with `fetch` to work around these incompatibilities.

### WorkOS SDK (`src/workos-sdk.ts`)

The same flow using the WorkOS Node SDK. The SDK handles discovery, authorization URL generation, and token exchange in a few lines -- no manual workarounds needed.

## Setup

Requires [Bun](https://bun.sh).

```bash
bun install
```

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Then edit `.env` with your WorkOS credentials from the dashboard. `WORKOS_CLIENT_SECRET` and `WORKOS_API_KEY` are the same value -- both are included for clarity since the generic OIDC flow and the SDK use different env var names.

Make sure `http://localhost:3000/callback` is registered as a redirect URI in the WorkOS dashboard for your environment.

## Usage

Run the generic OIDC client version:

```bash
bun run generic
```

Run the WorkOS SDK version:

```bash
bun run sdk
```

Both start a server at <http://localhost:3000>. Open it in your browser and click the sign-in link.

## Key finding

The WorkOS environment client ID has partial OIDC compatibility:

| Step | Standard OIDC | WorkOS | Compatible? |
|------|--------------|--------|-------------|
| Discovery | `.well-known/openid-configuration` | Supported | Yes (minimal -- missing `subject_types_supported`, `id_token_signing_alg_values_supported`, etc.) |
| Authorization | `/authorize` with PKCE | Supported | Yes |
| Token exchange | `application/x-www-form-urlencoded` with `token_type` in response | JSON body, proprietary response shape | No |

For fully spec-compliant OIDC, use WorkOS **Connect Applications** instead of the environment client ID.
