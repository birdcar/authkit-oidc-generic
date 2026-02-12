import * as client from "openid-client";

const CLIENT_ID = process.env.WORKOS_CLIENT_ID!;
const CLIENT_SECRET = process.env.WORKOS_API_KEY!;
const REDIRECT_URI = "http://localhost:3000/callback";
const PORT = 3000;

if (!CLIENT_SECRET) {
  console.error("Set WORKOS_API_KEY environment variable");
  process.exit(1);
}

// Discover OIDC configuration from WorkOS
const issuer = new URL(
  `https://api.workos.com/user_management/${CLIENT_ID}`
);

console.log("Discovering OIDC configuration...");
let config: client.Configuration;
try {
  config = await client.discovery(issuer, CLIENT_ID, {
    client_secret: CLIENT_SECRET,
  });
  console.log(
    "Discovery successful:",
    JSON.stringify(config.serverMetadata(), null, 2)
  );
} catch (e) {
  console.error("Discovery failed:", e);
  process.exit(1);
}

// Store PKCE verifier and state per-session (in-memory for this test)
let storedCodeVerifier: string;
let storedState: string;

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/") {
      // Generate PKCE and state
      storedCodeVerifier = client.randomPKCECodeVerifier();
      const codeChallenge =
        await client.calculatePKCECodeChallenge(storedCodeVerifier);
      storedState = client.randomState();

      const authUrl = client.buildAuthorizationUrl(config, {
        redirect_uri: REDIRECT_URI,
        scope: "openid",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state: storedState,
        provider: "authkit",
      });

      return new Response(
        `<h1>WorkOS OIDC Generic Client Test</h1>
         <p>Issuer: ${issuer.href}</p>
         <p><a href="${authUrl.href}">Sign in with WorkOS (generic OIDC)</a></p>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    if (url.pathname === "/callback") {
      console.log("\n--- Callback received ---");
      console.log("URL:", url.href);

      // Validate state manually
      const returnedState = url.searchParams.get("state");
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        const desc = url.searchParams.get("error_description") ?? "";
        return new Response(
          `<h1>Auth Error</h1><pre>${error}: ${desc}</pre><p><a href="/">Try again</a></p>`,
          { headers: { "Content-Type": "text/html" } }
        );
      }

      if (returnedState !== storedState) {
        return new Response(
          `<h1>State Mismatch</h1><pre>expected: ${storedState}\ngot: ${returnedState}</pre><p><a href="/">Try again</a></p>`,
          { headers: { "Content-Type": "text/html" } }
        );
      }

      if (!code) {
        return new Response(
          `<h1>Missing Code</h1><p><a href="/">Try again</a></p>`,
          { headers: { "Content-Type": "text/html" } }
        );
      }

      try {
        // Manual token exchange since WorkOS returns a non-standard response
        const tokenEndpoint = config.serverMetadata().token_endpoint!;
        console.log("Exchanging code at:", tokenEndpoint);

        const tokenRes = await fetch(tokenEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: "authorization_code",
            code,
            code_verifier: storedCodeVerifier,
          }),
        });

        const tokenData = await tokenRes.json();
        console.log("\nToken response status:", tokenRes.status);
        console.log("Token response:", JSON.stringify(tokenData, null, 2));

        if (!tokenRes.ok) {
          return new Response(
            `<h1>Token Exchange Failed (${tokenRes.status})</h1>
             <pre>${JSON.stringify(tokenData, null, 2)}</pre>
             <p><a href="/">Try again</a></p>`,
            { headers: { "Content-Type": "text/html" } }
          );
        }

        return new Response(
          `<h1>Authentication Successful</h1>
           <h2>Token Response</h2>
           <pre>${JSON.stringify(tokenData, null, 2)}</pre>
           <p><a href="/">Try again</a></p>`,
          { headers: { "Content-Type": "text/html" } }
        );
      } catch (e) {
        console.error("\nToken exchange failed:", e);
        return new Response(
          `<h1>Token Exchange Failed</h1>
           <pre>${e instanceof Error ? e.message : String(e)}</pre>
           <pre>${e instanceof Error ? e.stack : ""}</pre>
           <p><a href="/">Try again</a></p>`,
          { headers: { "Content-Type": "text/html" } }
        );
      }
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`\nServer running at http://localhost:${PORT}`);
console.log("Open http://localhost:3000 in your browser to test");
