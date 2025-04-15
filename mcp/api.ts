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
    // Set headers required for SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    
    const transport = new SSEServerTransport("/messages", res);
    const sessionId = transport.sessionId;
    
    // More detailed logging
    console.log(`New SSE connection established with sessionId: ${sessionId}`);
    console.log(`Client headers:`, req.headers);
    
    // Store the transport by session ID
    transports[sessionId] = transport;
    console.log(`Active SSE connections: ${Object.keys(transports).length}`);
    
    // Clean up when connection closes
    res.on("close", () => {
      console.log(`SSE connection closed for sessionId: ${sessionId}`);
      delete transports[sessionId];
      console.log(`Remaining active connections: ${Object.keys(transports).length}`);
    });
    
    try {
      await mcpServer.connect(transport);
      console.log(`MCP server successfully connected to transport ${sessionId}`);
    } catch (error) {
      console.error(`Error connecting MCP server to transport ${sessionId}:`, error);
      // Don't end the response here, as SSE connections should remain open
    }
    
    // Keep connection alive with periodic pings
    const keepAliveInterval = setInterval(() => {
      if (res.writableEnded) {
        clearInterval(keepAliveInterval);
        return;
      }
      res.write(`:keepalive\n\n`);
    }, 30000); // Send keepalive every 30 seconds
    
    // Clear interval when connection closes
    res.on("close", () => {
      clearInterval(keepAliveInterval);
    });
  }
);

// Message posting endpoint
export const messages = api.raw(
  { expose: true, path: "/messages", method: "POST" },
  async (req, res) => {
    // Log the entire query for debugging
    console.log("messages endpoint received query reqqq:", req.req.query);
    // console.log("messages endpoint received  res:", res);
    
    // Check if sessionId exists
    if (!req.query.sessionId) {
      console.error("No sessionId provided in query parameters");
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: "No sessionId provided in query parameters"
      }));
      return;
    }
    
    const sessionId = req.query.sessionId as string;
    console.log(`Looking for transport with sessionId: ${sessionId}`);
    
    const transport = transports[sessionId];

    if (transport) {
      try {
        await transport.handlePostMessage(req, res);
      } catch (error) {
        console.error(`Error handling message for sessionId ${sessionId}:`, error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          error: "Error processing message",
          details: error instanceof Error ? error.message : String(error)
        }));
      }
    } else {
      console.error(`No transport found for sessionId: ${sessionId}`);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: "No transport found for sessionId",
        details: `Session ${sessionId} not found or has expired`
      }));
    }
  }
); 