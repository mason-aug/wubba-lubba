import { api } from "encore.dev/api";

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