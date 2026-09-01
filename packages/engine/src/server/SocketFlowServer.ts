/**
 * SocketFlow Engine - WebSocket Server & Priority Drain Multiplexer
 * 
 * Manages WebSocket transport, priority queue scheduling, dynamic drain rate
 * backpressure simulation, and real-time telemetry emission.
 */

import { WebSocketServer, WebSocket } from 'ws';
import {
  PacketPriority,
  SocketFlowServerOptions,
  ClientCommand,
  SendChatPayload,
  SendTypingPayload,
  SendReadReceiptPayload,
  SetDrainThrottlePayload,
  SimulateBurstPayload,
  TelemetrySnapshot,
} from '../types.js';
import { MinHeapQueue } from '../dsa/MinHeapQueue.js';
import { TrieGuardrail } from '../dsa/TrieGuardrail.js';
import { CancelablePipeline } from '../pipeline/CancelablePipeline.js';

export class SocketFlowServer {
  private wss: WebSocketServer | null = null;
  private minHeap: MinHeapQueue;
  private trieGuardrail: TrieGuardrail;
  private pipeline: CancelablePipeline;

  private port: number;
  private externalServer?: import('http').Server;
  private drainIntervalMs: number;
  private drainTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private activeClients: Set<WebSocket> = new Set();

  constructor(options: SocketFlowServerOptions = {}) {
    this.port = options.port ?? 8080;
    this.externalServer = options.server;
    this.drainIntervalMs = options.drainIntervalMs ?? 120;

    this.minHeap = new MinHeapQueue();
    this.trieGuardrail = new TrieGuardrail();

    // Populate initial banned words if provided
    if (options.bannedWords && options.bannedWords.length > 0) {
      this.trieGuardrail.insertBatch(options.bannedWords);
    } else {
      // Default common guardrail patterns
      this.trieGuardrail.insertBatch([
        'secret_key',
        'spam-link.com',
        'profanity',
        'leak_token',
        'api_secret',
        'credit_card',
      ]);
    }

    this.pipeline = new CancelablePipeline({
      minHeap: this.minHeap,
      trieGuardrail: this.trieGuardrail,
      coalesceWindowMs: options.coalesceWindowMs ?? 800,
      aiChunkDelayMs: options.aiChunkDelayMs ?? 25,
      onTelemetry: (_sessionId, snapshot) => {
        this.broadcastTelemetry(snapshot);
      },
    });
  }

  /**
   * Starts the WebSocket server and initializes the drain multiplexer loop.
   */
  public start(): Promise<void> {
    return new Promise((resolve) => {
      if (this.isRunning) {
        resolve();
        return;
      }

      const serverConfig = this.externalServer
        ? { server: this.externalServer }
        : { port: this.port };

      this.wss = new WebSocketServer(serverConfig);
      this.isRunning = true;

      this.wss.on('connection', (ws: WebSocket) => {
        this.activeClients.add(ws);
        const defaultSessionId = 'session_default';

        // Send initial telemetry frame immediately on connect
        const initialTelemetry = this.getLatestTelemetry(defaultSessionId);
        ws.send(JSON.stringify({ type: 'TELEMETRY', data: initialTelemetry }));

        ws.on('message', (data) => {
          this.handleClientMessage(ws, data.toString());
        });

        ws.on('close', () => {
          this.activeClients.delete(ws);
        });

        ws.on('error', (err) => {
          console.error('[SocketFlowServer] Client connection error:', err);
          this.activeClients.delete(ws);
        });
      });

      this.startDrainLoop();
      resolve();
    });
  }

  /**
   * Stops the server, terminates clients, and clears all scheduled loops.
   */
  public stop(): Promise<void> {
    return new Promise((resolve) => {
      this.isRunning = false;

      if (this.drainTimer) {
        clearTimeout(this.drainTimer);
        this.drainTimer = null;
      }

      this.pipeline.destroy();

      for (const client of this.activeClients) {
        try {
          client.close();
        } catch {
          // Ignore close errors
        }
      }
      this.activeClients.clear();

      if (this.wss) {
        this.wss.close(() => {
          this.wss = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Dynamically adjusts drain rate (e.g. 20ms fast vs 250ms slow network simulation)
   */
  public setDrainThrottle(intervalMs: number): void {
    this.drainIntervalMs = Math.max(1, intervalMs);
    // Restart drain loop with new interval immediately
    if (this.isRunning) {
      if (this.drainTimer) {
        clearTimeout(this.drainTimer);
        this.drainTimer = null;
      }
      this.startDrainLoop();
    }
  }

  /**
   * Recursive self-scheduling drain loop to support instant dynamic throttling
   */
  private startDrainLoop(): void {
    if (!this.isRunning) return;

    this.drainTimer = setTimeout(() => {
      this.drainNextPacket();
      this.startDrainLoop();
    }, this.drainIntervalMs);
  }

  /**
   * Dequeues the highest priority packet from MinHeapQueue and emits it over the socket.
   */
  private drainNextPacket(): void {
    if (this.minHeap.size() === 0) return;

    const packet = this.minHeap.dequeue();
    if (!packet) return;

    const payloadStr = JSON.stringify({
      type: 'PACKET',
      data: packet,
    });

    for (const client of this.activeClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payloadStr);
      }
    }

    // Broadcast updated telemetry state after queue drain
    this.broadcastTelemetry(this.getLatestTelemetry('session_default'));
  }

  /**
   * Parses and dispatches incoming WebSocket commands
   */
  private handleClientMessage(_ws: WebSocket, raw: string): void {
    try {
      const command = JSON.parse(raw) as ClientCommand;
      const sessionId = command.sessionId || 'session_default';

      switch (command.type) {
        case 'SEND_CHAT': {
          const payload = command.payload as SendChatPayload;
          if (payload?.urgent) {
            // P1 High Priority human chat - bypasses debounce & jumps queue
            this.minHeap.enqueue({
              id: `urgent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              priority: PacketPriority.HIGH,
              type: 'CHAT_MSG',
              payload: {
                text: payload.text,
                sender: payload.sender || 'Human (Urgent)',
                timestamp: Date.now(),
              },
            });
          } else {
            // Normal message triggers 3-stage coalescing pipeline
            this.pipeline.handleIncomingUserMessage(
              sessionId,
              payload.text,
              payload.apiKey,
              payload.provider,
              payload.model
            );
          }
          break;
        }

        case 'SEND_TYPING': {
          const payload = command.payload as SendTypingPayload;
          this.minHeap.enqueue({
            id: `typing_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            priority: PacketPriority.HIGH,
            type: 'TYPING',
            payload: {
              sender: payload?.sender || 'Human',
              timestamp: Date.now(),
            },
          });
          break;
        }

        case 'SEND_READ_RECEIPT': {
          const payload = command.payload as SendReadReceiptPayload;
          this.minHeap.enqueue({
            id: `rr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            priority: PacketPriority.HIGH,
            type: 'READ_RECEIPT',
            payload: {
              messageId: payload?.messageId,
              timestamp: Date.now(),
            },
          });
          break;
        }

        case 'ABORT_PIPELINE': {
          this.pipeline.abortSession(sessionId);
          break;
        }

        case 'SET_DRAIN_THROTTLE': {
          const payload = command.payload as SetDrainThrottlePayload;
          if (payload?.intervalMs) {
            this.setDrainThrottle(payload.intervalMs);
            this.broadcastTelemetry(this.getLatestTelemetry(sessionId));
          }
          break;
        }

        case 'SIMULATE_BURST': {
          const payload = command.payload as SimulateBurstPayload;
          const messages = payload?.messages || [
            'Hey',
            'Need help with checkout',
            'Wait, on mobile Safari',
          ];
          const interval = payload?.intervalMs ?? 300;

          messages.forEach((msg, idx) => {
            setTimeout(() => {
              this.pipeline.handleIncomingUserMessage(sessionId, msg);
            }, idx * interval);
          });
          break;
        }

        default:
          console.warn('[SocketFlowServer] Unrecognized command type:', command.type);
      }
    } catch (err) {
      console.error('[SocketFlowServer] Failed to parse client message:', err);
    }
  }

  /**
   * Broadcasts telemetry frame to all active WebSocket clients
   */
  private broadcastTelemetry(snapshot: TelemetrySnapshot): void {
    const frame = JSON.stringify({
      type: 'TELEMETRY',
      data: {
        ...snapshot,
        drainIntervalMs: this.drainIntervalMs,
      },
    });

    for (const client of this.activeClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(frame);
      }
    }
  }

  /**
   * Gets current combined telemetry snapshot
   */
  public getLatestTelemetry(sessionId: string): TelemetrySnapshot {
    const pipelineSnapshot = this.pipeline.getTelemetrySnapshot(sessionId);
    return {
      ...pipelineSnapshot,
      drainIntervalMs: this.drainIntervalMs,
    };
  }

  // Getters for internal structures (Mode 2 consumption)
  public getMinHeap(): MinHeapQueue {
    return this.minHeap;
  }

  public getTrieGuardrail(): TrieGuardrail {
    return this.trieGuardrail;
  }

  public getPipeline(): CancelablePipeline {
    return this.pipeline;
  }

  public getDrainIntervalMs(): number {
    return this.drainIntervalMs;
  }
}
