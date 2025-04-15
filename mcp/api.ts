import { api } from "encore.dev/api";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
interface StatusResponse {
  status: string;
  service: string;
}

// Basic status endpoint for the MCP service
export const status = api(
  { method: "GET", expose: true },
  async (): Promise<StatusResponse> => {
    return {
      status: "online",
      service: "mcp"
    };
  }
); 

// Create a global server instance
const mcpServer = new McpServer(
  { name: "mcp-server", version: "1.0.0" },
  { capabilities: {} }
);

mcpServer.tool("add", { a: z.number(), b: z.number() }, async ({ a, b }) => ({
	content: [{ type: "text", text: String(a + b) }],
}));

// Store transports by session ID
const transports: {[sessionId: string]: SSEServerTransport} = {};

// SSE endpoint
export const sse = api.raw(
  { expose: true, path: "/sse", method: "GET" },
  async (req, res) => {
    const transport = new SSEServerTransport("/messages", res);
    // Store the transport by session ID
    transports[transport.sessionId] = transport;
    
    // Clean up when connection closes
    res.on("close", () => {
      delete transports[transport.sessionId];
    });
    
    await mcpServer.connect(transport);
  }
);

// Message posting endpoint
export const messages = api.raw(
  { expose: true, path: "/messages", method: "POST" },
  async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports[sessionId];
    
    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("No transport found for sessionId");
    }
  }
); 