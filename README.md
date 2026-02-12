# authkit-oidc-generic

A minimal test app that attempts to authenticate with [WorkOS User Management](https://workos.com/docs/user-management) using a generic OIDC client library ([openid-client](https://github.com/panva/openid-client)) instead of the WorkOS SDK.

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

The app tests each step of the OIDC flow:

1. **Discovery** -- Uses `openid-client` to fetch the `.well-known/openid-configuration` endpoint. This works.
2. **Authorization** -- Builds a standard OAuth2 authorize URL with PKCE and redirects the user to AuthKit. This works.
3. **Token exchange** -- Exchanges the authorization code for tokens at the token endpoint. This is where generic OIDC clients break, because:
   - The token endpoint expects a **JSON** request body (generic clients send `application/x-www-form-urlencoded` per the OAuth2 spec)
   - The response is a **WorkOS-proprietary format** (includes `user`, `authentication_method`, etc.) and is missing `token_type`, which the OAuth2 spec requires

The token exchange in this app is done manually with `fetch` to work around these incompatibilities.

## Setup

Requires [Bun](https://bun.sh).

```bash
bun install
```

Create a `.env` file:

```
WORKOS_CLIENT_ID=client_XXXXX
WORKOS_CLIENT_SECRET=sk_test_XXXXX
```

Make sure `http://localhost:3000/callback` is registered as a redirect URI in the WorkOS dashboard for your environment.

## Usage

```bash
bun run index.ts
```

Open http://localhost:3000 in your browser and click "Sign in with WorkOS".

## Key finding

The WorkOS environment client ID has partial OIDC compatibility:

| Step | Standard OIDC | WorkOS | Compatible? |
|------|--------------|--------|-------------|
| Discovery | `.well-known/openid-configuration` | Supported | Yes (minimal -- missing `subject_types_supported`, `id_token_signing_alg_values_supported`, etc.) |
| Authorization | `/authorize` with PKCE | Supported | Yes |
| Token exchange | `application/x-www-form-urlencoded` with `token_type` in response | JSON body, proprietary response shape | No |

For fully spec-compliant OIDC, use WorkOS **Connect Applications** instead of the environment client ID.
