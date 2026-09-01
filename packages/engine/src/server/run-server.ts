/**
 * SocketFlow Engine - Standalone Server Runner
 * Starts the priority WebSocket multiplexer on port 8080.
 */

import http from 'node:http';
import { SocketFlowServer } from './SocketFlowServer.js';

const PORT = Number(process.env.PORT) || 8080;

// Create HTTP server for health checks & WebSocket upgrade
const httpServer = http.createServer((req, res) => {
  // Simple health & status endpoint
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(
      JSON.stringify({
        status: 'UP',
        engine: 'socketflow-engine',
        version: '0.1.0',
        wsUrl: `ws://localhost:${PORT}`,
        activeDrainRateMs: server.getDrainIntervalMs(),
        queuedPackets: server.getMinHeap().size(),
      })
    );
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

const server = new SocketFlowServer({
  server: httpServer,
  port: PORT,
  coalesceWindowMs: 800,
  drainIntervalMs: 20,
  bannedWords: [
    'secret_key',
    'spam-link.com',
    'profanity',
    'leak_token',
    'credit_card',
    'api_secret',
  ],
});

httpServer.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`🚀 SocketFlow Engine running at:`);
  console.log(`   - HTTP Status:    http://localhost:${PORT}`);
  console.log(`   - WebSocket URL:  ws://localhost:${PORT}`);
  console.log(`   - Health Check:   http://localhost:${PORT}/health`);
  console.log(`================================================================`);
});

await server.start();

