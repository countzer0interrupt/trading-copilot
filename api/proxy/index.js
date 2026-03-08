
const { app } = require("@azure/functions");

app.http("proxy", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "proxy",
  handler: async (request, context) => {
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
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        };
      }

      // Use streaming to avoid Azure timeout on long Anthropic calls
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "mcp-client-2025-04-04,prompt-caching-2024-07-31",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = await response.json();
        return {
          status: response.status,
          body: JSON.stringify(errData),
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        };
      }

      // Stream the response back to keep the connection alive
      const readable = response.body;
      return {
        status: 200,
        body: readable,
        headers: {
          "Content-Type": "text/event-stream",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache",
          "X-Accel-Buffering": "no",
        },
      };
    } catch (err) {
      return {
        status: 500,
        body: JSON.stringify({ error: err.message }),
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      };
    }
  },
});