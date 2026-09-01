'use client';

/**
 * SocketFlow Studio - Headless Client WebSocket & State Hook
 * 
 * Manages WebSocket connection, real-time packet demuxing, live telemetry state,
 * and high-priority action dispatchers for custom UI components.
 * 
 * Zero UI opinions / Pure logic layer.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  QueuePacket,
  TelemetrySnapshot,
  ClientCommand,
} from 'socketflow-engine';

export interface DisplayMessage {
  id: string;
  runId?: string;
  sender: string;
  text: string;
  priority: number;
  type: string;
  timestamp: number;
  isStreaming?: boolean;
  isAborted?: boolean;
}

export interface SocketFlowActions {
  sendMessage: (
    text: string,
    options?: { urgent?: boolean; apiKey?: string; provider?: string; model?: string }
  ) => void;
  sendPriorityHumanSignal: (
    type: 'TYPING' | 'READ_RECEIPT' | 'URGENT_CHAT',
    text?: string
  ) => void;
  simulateRapidBurst: (messages?: string[], intervalMs?: number) => void;
  abortCurrentStream: () => void;
  setNetworkDrainRate: (intervalMs: number) => void;
}

export interface UseSocketFlowReturn {
  isConnected: boolean;
  messages: DisplayMessage[];
  telemetry: TelemetrySnapshot;
  activeTypingUser: string | null;
  actions: SocketFlowActions;
}

const DEFAULT_TELEMETRY: TelemetrySnapshot = {
  heapQueueSnapshot: [],
  activeStage: 'IDLE',
  coalescedBuffer: [],
  savedApiCalls: 0,
  totalPipelineRuns: 0,
  lastTrieScanMicros: 0,
  flaggedWords: [],
  drainIntervalMs: 20,
};

export function useSocketFlow(
  serverUrl: string = 'ws://localhost:8080'
): UseSocketFlowReturn {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>(DEFAULT_TELEMETRY);
  const [activeTypingUser, setActiveTypingUser] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Send typed command over WebSocket
  const sendCommand = useCallback((command: ClientCommand) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(command));
    } else {
      console.warn('[useSocketFlow] WebSocket is not connected.');
    }
  }, []);

  // Action: standard chat message
  const sendMessage = useCallback(
    (
      text: string,
      options?: { urgent?: boolean; apiKey?: string; provider?: string; model?: string }
    ) => {
      if (!text.trim()) return;
      sendCommand({
        type: 'SEND_CHAT',
        payload: {
          text,
          sender: options?.urgent ? 'You (Urgent)' : 'You',
          urgent: options?.urgent,
          apiKey: options?.apiKey,
          provider: options?.provider || 'openrouter',
          model: options?.model,
        },
      });
    },
    [sendCommand]
  );

  // Action: high-priority human signal (P1)
  const sendPriorityHumanSignal = useCallback(
    (type: 'TYPING' | 'READ_RECEIPT' | 'URGENT_CHAT', text?: string) => {
      if (type === 'TYPING') {
        sendCommand({
          type: 'SEND_TYPING',
          payload: { sender: 'You' },
        });
      } else if (type === 'READ_RECEIPT') {
        sendCommand({
          type: 'SEND_READ_RECEIPT',
          payload: { messageId: 'latest' },
        });
      } else if (type === 'URGENT_CHAT' && text) {
        sendCommand({
          type: 'SEND_CHAT',
          payload: { text, sender: 'You (Urgent)', urgent: true },
        });
      }
    },
    [sendCommand]
  );

  // Action: simulate rapid-fire burst messages
  const simulateRapidBurst = useCallback(
    (messagesList?: string[], intervalMs: number = 300) => {
      sendCommand({
        type: 'SIMULATE_BURST',
        payload: {
          messages: messagesList || [
            'Hey',
            'Need help with checkout',
            'Wait, on mobile Safari',
          ],
          intervalMs,
        },
      });
    },
    [sendCommand]
  );

  // Action: abort active pipeline
  const abortCurrentStream = useCallback(() => {
    sendCommand({
      type: 'ABORT_PIPELINE',
    });
  }, [sendCommand]);

  // Action: adjust drain rate dynamically (simulate backpressure)
  const setNetworkDrainRate = useCallback(
    (intervalMs: number) => {
      sendCommand({
        type: 'SET_DRAIN_THROTTLE',
        payload: { intervalMs },
      });
    },
    [sendCommand]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let ws: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      try {
        ws = new WebSocket(serverUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);

            if (parsed.type === 'TELEMETRY') {
              setTelemetry(parsed.data as TelemetrySnapshot);
            } else if (parsed.type === 'PACKET') {
              const packet = parsed.data as QueuePacket<any>;

              if (packet.type === 'CHAT_MSG') {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: packet.id,
                    runId: packet.runId,
                    sender: packet.payload?.sender || 'Human',
                    text: packet.payload?.text || '',
                    priority: packet.priority,
                    type: packet.type,
                    timestamp: packet.timestamp,
                  },
                ]);
              } else if (packet.type === 'TYPING') {
                setActiveTypingUser(packet.payload?.sender || 'Someone');
                if (typingTimeoutRef.current) {
                  clearTimeout(typingTimeoutRef.current);
                }
                typingTimeoutRef.current = setTimeout(() => {
                  setActiveTypingUser(null);
                }, 1500);
              } else if (packet.type === 'AI_CHUNK') {
                const runId = packet.runId || 'default_run';
                const token = packet.payload?.token || '';

                setMessages((prev) => {
                  const existingIndex = prev.findIndex((m) => m.runId === runId);
                  if (existingIndex !== -1) {
                    const updated = [...prev];
                    const existing = updated[existingIndex]!;
                    updated[existingIndex] = {
                      ...existing,
                      text: existing.text + token,
                      isStreaming: !packet.payload?.isLast,
                    };
                    return updated;
                  } else {
                    return [
                      ...prev,
                      {
                        id: packet.id,
                        runId,
                        sender: 'SocketFlow Agent',
                        text: token,
                        priority: packet.priority,
                        type: 'AI_STREAM',
                        timestamp: packet.timestamp,
                        isStreaming: true,
                      },
                    ];
                  }
                });
              } else if (packet.type === 'AI_DONE') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.runId === packet.runId ? { ...m, isStreaming: false } : m
                  )
                );
              } else if (packet.type === 'PIPELINE_ABORTED') {
                const abortedRunId = packet.payload?.abortedRunId;
                setMessages((prev) => {
                  const marked = prev.map((m) =>
                    m.runId === abortedRunId
                      ? { ...m, isStreaming: false, isAborted: true }
                      : m
                  );
                  return [
                    ...marked,
                    {
                      id: packet.id,
                      runId: abortedRunId,
                      sender: 'System (P0 Preemption)',
                      text: `[Stream Aborted: ${packet.payload?.reason || 'INTERRUPT'} - Pruned ${packet.payload?.prunedTokens ?? 0} queued tokens]`,
                      priority: packet.priority,
                      type: 'ABORT_NOTICE',
                      timestamp: packet.timestamp,
                      isAborted: true,
                    },
                  ];
                });
              }
            }
          } catch (err) {
            console.error('[useSocketFlow] Error parsing incoming frame:', err);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          socketRef.current = null;
          // Reconnect after 2 seconds
          reconnectTimeout = setTimeout(connect, 2000);
        };

        ws.onerror = () => {
          setIsConnected(false);
          ws.close();
        };
      } catch (err) {
        console.error('[useSocketFlow] Connection initialization failed:', err);
        reconnectTimeout = setTimeout(connect, 2000);
      }
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [serverUrl]);

  return {
    isConnected,
    messages,
    telemetry,
    activeTypingUser,
    actions: {
      sendMessage,
      sendPriorityHumanSignal,
      simulateRapidBurst,
      abortCurrentStream,
      setNetworkDrainRate,
    },
  };
}

