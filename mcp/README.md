# MCP Service

This service provides Server-Sent Events (SSE) functionality for real-time communication using the Model Context Protocol SDK.

## Dependencies

This service uses the `@modelcontextprotocol/sdk` package which provides the `Server` and `SSEServerTransport` classes.

```bash
npm install @modelcontextprotocol/sdk
```

## Endpoints

### Status

```
GET /status
```

Returns basic status information about the MCP service.

### SSE Connection

```
GET /sse
```

Establishes a Server-Sent Events connection. The client will receive real-time messages pushed from the server.

### Post Message

```
POST /messages
```

Sends a message that will be broadcast to all connected SSE clients.

## Client-side Usage Example

```javascript
// Connect to SSE endpoint
const eventSource = new EventSource('/sse');

// Listen for messages
eventSource.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received message:', message);
};

// Send a message to all connected clients
async function sendMessage(message) {
  await fetch('/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
}

// Example usage
sendMessage({ 
  type: 'chat',
  content: 'Hello everyone!',
  sender: 'User123'
});
```

## Implementation Details

The SSE implementation uses Encore.ts raw API endpoints to:

1. Establish persistent connections with clients
2. Receive messages via POST requests
3. Broadcast messages to all connected clients
4. Maintain connection health with keepalive signals

The server manages all active connections and handles message distribution. 