
const { app } = require("@azure/functions");

app.http("proxy", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "proxy",
  handler: async (request, context) => {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      };
    }

    try {
      const body = await request.json();
      const apiKey = process.env.ANTHROPIC_API_KEY;

      if (!apiKey) {
        return {
          status: 500,
          body: JSON.stringify({ error: "API key not configured" }),
          headers: { "Content-Type": "application/json" },
        };
      }

      let response;
      try {
        response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "mcp-client-2025-04-04,prompt-caching-2024-07-31",
          },
          body: JSON.stringify(body),
        });
      } catch (fetchErr) {
        return {
          status: 500,
          body: JSON.stringify({ error: "Fetch failed", detail: fetchErr.message }),
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        };
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        return {
          status: 500,
          body: JSON.stringify({ error: "JSON parse failed", status: response.status }),
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        };
      }

      return {
        status: response.status,
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      };
    } catch (err) {
      return {
        status: 500,
        body: JSON.stringify({ error: err.message }),
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      };
    }
  },
});