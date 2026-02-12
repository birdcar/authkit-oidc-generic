import { WorkOS } from "@workos-inc/node";

const CLIENT_ID = process.env.WORKOS_CLIENT_ID!;
const WORKOS_API_KEY = process.env.WORKOS_API_KEY!;
const REDIRECT_URI = "http://localhost:3000/callback";
const PORT = 3000;

if (!WORKOS_API_KEY) {
  console.error("Set WORKOS_API_KEY environment variable");
  process.exit(1);
}

const workos = new WorkOS(WORKOS_API_KEY);

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/") {
      const authUrl = workos.userManagement.getAuthorizationUrl({
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
        provider: "authkit",
      });

      return new Response(
        `<h1>WorkOS SDK Test</h1>
         <p><a href="${authUrl}">Sign in with WorkOS (SDK)</a></p>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");

      if (!code) {
        return new Response(
          `<h1>Missing Code</h1><p><a href="/">Try again</a></p>`,
          { headers: { "Content-Type": "text/html" } }
        );
      }

      try {
        const authResponse =
          await workos.userManagement.authenticateWithCode({
            code,
            clientId: CLIENT_ID,
          });

        console.log(
          "\nAuth response:",
          JSON.stringify(authResponse, null, 2)
        );

        return new Response(
          `<h1>Authentication Successful</h1>
           <h2>User</h2>
           <pre>${JSON.stringify(authResponse.user, null, 2)}</pre>
           <h2>Full Response</h2>
           <pre>${JSON.stringify(authResponse, null, 2)}</pre>
           <p><a href="/">Try again</a></p>`,
          { headers: { "Content-Type": "text/html" } }
        );
      } catch (e) {
        console.error("\nAuth failed:", e);
        return new Response(
          `<h1>Authentication Failed</h1>
           <pre>${e instanceof Error ? e.message : String(e)}</pre>
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
