/**
 * SocketFlow Engine - Core Types and Interfaces
 * Strict TypeScript specifications for priority packet scheduling,
 * trie guardrails, cancelable pipelines, and real-time telemetry.
 */

export enum PacketPriority {
  CRITICAL = 0, // P0: Pipeline ABORT / Interrupt signals, system health/heartbeat frames
  HIGH = 1,     // P1: Human-to-Human chat messages, live typing indicators, read receipts
  MEDIUM = 2,   // P2: Streaming AI Agent token chunks
  LOW = 3       // P3: Historical message sync, analytics, telemetry snapshots
}

export type PacketType =
  | 'CHAT_MSG'
  | 'TYPING'
  | 'READ_RECEIPT'
  | 'AI_CHUNK'
  | 'AI_DONE'
  | 'PIPELINE_ABORTED'
  | 'TELEMETRY';

export interface QueuePacket<T = unknown> {
  id: string;
  runId?: string; // Links AI token chunks to a specific pipeline execution
  priority: PacketPriority;
  sequenceId: number; // Monotonically auto-incremented integer for strict FIFO within identical priorities
  timestamp: number;
  type: PacketType;
  payload: T;
}

export type PipelineStage =
  | 'IDLE'
  | 'COALESCING'
  | 'STAGE_1_TRIE'
  | 'STAGE_2_CONTEXT'
  | 'STAGE_3_STREAMING'
  | 'ABORTED'
  | 'COMPLETED';

export interface TelemetrySnapshot {
  heapQueueSnapshot: QueuePacket[];
  activeStage: PipelineStage;
  coalescedBuffer: string[];
  savedApiCalls: number;
  totalPipelineRuns: number;
  lastTrieScanMicros: number;
  flaggedWords: string[];
  drainIntervalMs: number;
}

export interface TrieSanitizeResult {
  sanitized: string;
  flaggedWords: string[];
  durationMicros: number;
}

export type ClientCommandType =
  | 'SEND_CHAT'
  | 'SEND_TYPING'
  | 'SEND_READ_RECEIPT'
  | 'ABORT_PIPELINE'
  | 'SET_DRAIN_THROTTLE'
  | 'SIMULATE_BURST';

export interface ClientCommand<T = unknown> {
  type: ClientCommandType;
  payload?: T;
  sessionId?: string;
}

export interface SendChatPayload {
  text: string;
  sender?: string;
  urgent?: boolean;
  apiKey?: string;
  provider?: 'openrouter' | 'openai' | 'local';
  model?: string;
}

export interface SendTypingPayload {
  sender?: string;
}

export interface SendReadReceiptPayload {
  messageId?: string;
  sender?: string;
}

export interface SetDrainThrottlePayload {
  intervalMs: number;
}

export interface SimulateBurstPayload {
  messages: string[];
  intervalMs?: number;
}

export interface SocketFlowServerOptions {
  port?: number;
  server?: import('http').Server;
  coalesceWindowMs?: number;
  drainIntervalMs?: number;
  bannedWords?: string[];
  aiChunkDelayMs?: number;
}

