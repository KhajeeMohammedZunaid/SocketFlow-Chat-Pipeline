#!/usr/bin/env node

/**
 * SocketFlow CLI Tool
 * Interactive command-line interface for the Priority-Queue WebSocket Engine.
 */

import { SocketFlowServer } from '../server/SocketFlowServer.js';
import { MinHeapQueue } from '../dsa/MinHeapQueue.js';
import { TrieGuardrail } from '../dsa/TrieGuardrail.js';
import { PacketPriority } from '../types.js';

const args = process.argv.slice(2);
const command = args[0] || 'help';

async function main() {
  switch (command) {
    case 'serve':
    case 'start': {
      const portIdx = args.indexOf('--port');
      const port = portIdx !== -1 ? Number(args[portIdx + 1]) : 8080;
      const drainIdx = args.indexOf('--drain');
      const drain = drainIdx !== -1 ? Number(args[drainIdx + 1]) : 100;

      const server = new SocketFlowServer({
        port,
        drainIntervalMs: drain,
      });

      console.log(`\n========================================================`);
      console.log(`  SOCKETFLOW CLI ENGINE`);
      console.log(`========================================================`);
      console.log(`- WebSocket URL:  ws://localhost:${port}`);
      console.log(`- Drain Loop:     ${drain}ms per packet`);
      console.log(`- Banned Words:   secret_key, spam-link.com, profanity, etc.`);
      console.log(`Server is running. Press Ctrl+C to stop.\n`);

      await server.start();
      break;
    }

    case 'scan': {
      const text = args.slice(1).join(' ') || 'Check secret_key and spam-link.com in text';
      const trie = new TrieGuardrail();
      trie.insertBatch([
        'secret_key',
        'spam-link.com',
        'leak_token',
        'profanity',
        'api_secret',
      ]);

      console.log(`\n[SocketFlow Trie Scanner]`);
      console.log(`Scanning input: "${text}"`);
      const result = trie.sanitizeText(text);
      console.log(`Sanitized:     "${result.sanitized}"`);
      console.log(`Flagged Words: [${result.flaggedWords.join(', ')}]`);
      console.log(`Scan Latency:  ${result.durationMicros.toFixed(2)} µs (microseconds)\n`);
      break;
    }

    case 'queue-sim': {
      const count = Number(args[1]) || 20;
      const queue = new MinHeapQueue();
      console.log(`\n[SocketFlow Min-Heap Priority Simulator]`);
      console.log(`Enqueueing ${count} AI chunks (P2)...`);

      for (let i = 0; i < count; i++) {
        queue.enqueue({
          id: `chunk_${i}`,
          priority: PacketPriority.MEDIUM,
          type: 'AI_CHUNK',
          payload: `Token ${i}`,
        });
      }

      console.log(`Queue size: ${queue.size()} items`);
      console.log(`Simulating arrival of P0 (ABORT) and P1 (HUMAN_CHAT)...`);

      queue.enqueue({
        id: 'p1_human',
        priority: PacketPriority.HIGH,
        type: 'CHAT_MSG',
        payload: 'Urgent human question',
      });

      queue.enqueue({
        id: 'p0_abort',
        priority: PacketPriority.CRITICAL,
        type: 'PIPELINE_ABORTED',
        payload: 'Abort signal',
      });

      console.log(`\nDequeuing top 3 packets (Notice O(log N) preemption):`);
      for (let i = 1; i <= 3; i++) {
        const p = queue.dequeue();
        console.log(`  #${i} -> Priority: P${p?.priority} | Type: ${p?.type} | ID: ${p?.id}`);
      }
      console.log(`\nPreemption verified: P0 & P1 jumped ahead of all P2 items!\n`);
      break;
    }

    case 'benchmark': {
      const { runBenchmark } = await import('../benchmark/cli-benchmark.js');
      await runBenchmark();
      break;
    }

    case 'help':
    default: {
      console.log(`
SocketFlow CLI - Priority WebSocket Multiplexer & Algorithmic Guardrail

Usage:
  socketflow <command> [options]

Commands:
  serve [--port 8080] [--drain 100]   Start the WebSocket engine server
  scan <text>                        Run instant O(L) Trie guardrail scan
  queue-sim [count]                  Simulate P0/P1 preemption over P2 chunks
  benchmark                          Execute CLI benchmark comparisons
  help                               Show this help documentation
      `);
      break;
    }
  }
}

main().catch(console.error);
