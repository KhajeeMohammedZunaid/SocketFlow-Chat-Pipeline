/**
 * SocketFlow Engine - Comprehensive Unit Test Suite
 * 
 * Tests:
 *   1. Binary MinHeapQueue O(log N) priority scheduling, FIFO tie-breaking, and runId pruning
 *   2. TrieGuardrail O(L) prefix-tree sanitization and microsecond profiling
 *   3. CancelablePipeline 800ms sliding-window coalescing and mid-stream interrupt
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MinHeapQueue } from '../src/dsa/MinHeapQueue.js';
import { TrieGuardrail } from '../src/dsa/TrieGuardrail.js';
import { CancelablePipeline } from '../src/pipeline/CancelablePipeline.js';
import { PacketPriority } from '../src/types.js';

describe('MinHeapQueue (Binary Min-Heap Priority Queue)', () => {
  it('should maintain strict priority order (P0 > P1 > P2 > P3)', () => {
    const queue = new MinHeapQueue();

    queue.enqueue({ id: 'low-1', priority: PacketPriority.LOW, type: 'TELEMETRY', payload: 'p3' });
    queue.enqueue({ id: 'med-1', priority: PacketPriority.MEDIUM, type: 'AI_CHUNK', payload: 'p2' });
    queue.enqueue({ id: 'crit-1', priority: PacketPriority.CRITICAL, type: 'PIPELINE_ABORTED', payload: 'p0' });
    queue.enqueue({ id: 'high-1', priority: PacketPriority.HIGH, type: 'CHAT_MSG', payload: 'p1' });

    assert.equal(queue.size(), 4);

    const first = queue.dequeue();
    assert.equal(first?.priority, PacketPriority.CRITICAL);
    assert.equal(first?.id, 'crit-1');

    const second = queue.dequeue();
    assert.equal(second?.priority, PacketPriority.HIGH);
    assert.equal(second?.id, 'high-1');

    const third = queue.dequeue();
    assert.equal(third?.priority, PacketPriority.MEDIUM);
    assert.equal(third?.id, 'med-1');

    const fourth = queue.dequeue();
    assert.equal(fourth?.priority, PacketPriority.LOW);
    assert.equal(fourth?.id, 'low-1');

    assert.equal(queue.dequeue(), undefined);
    assert.equal(queue.isEmpty(), true);
  });

  it('should preempt 100 queued P2 AI tokens when a P0 packet arrives', () => {
    const queue = new MinHeapQueue();

    // Fill queue with 100 P2 packets
    for (let i = 0; i < 100; i++) {
      queue.enqueue({
        id: `token-${i}`,
        priority: PacketPriority.MEDIUM,
        type: 'AI_CHUNK',
        payload: `token_${i}`,
      });
    }

    assert.equal(queue.size(), 100);

    // Enqueue urgent P0 abort packet
    queue.enqueue({
      id: 'urgent-abort',
      priority: PacketPriority.CRITICAL,
      type: 'PIPELINE_ABORTED',
      payload: 'ABORT',
    });

    assert.equal(queue.size(), 101);

    // Dequeue must return the P0 packet immediately!
    const next = queue.dequeue();
    assert.equal(next?.id, 'urgent-abort');
    assert.equal(next?.priority, PacketPriority.CRITICAL);
  });

  it('should preserve strict FIFO order for equal priorities using monotonic sequenceId', () => {
    const queue = new MinHeapQueue();

    // Insert three P1 packets in specific order
    queue.enqueue({ id: 'msg-alpha', priority: PacketPriority.HIGH, type: 'CHAT_MSG', payload: 'first' });
    queue.enqueue({ id: 'msg-beta', priority: PacketPriority.HIGH, type: 'CHAT_MSG', payload: 'second' });
    queue.enqueue({ id: 'msg-gamma', priority: PacketPriority.HIGH, type: 'CHAT_MSG', payload: 'third' });

    const p1 = queue.dequeue();
    const p2 = queue.dequeue();
    const p3 = queue.dequeue();

    assert.equal(p1?.id, 'msg-alpha');
    assert.equal(p2?.id, 'msg-beta');
    assert.equal(p3?.id, 'msg-gamma');
  });

  it('should prune all packets matching an aborted runId and maintain heap invariant', () => {
    const queue = new MinHeapQueue();

    queue.enqueue({ id: 'p0', priority: PacketPriority.CRITICAL, type: 'PIPELINE_ABORTED', payload: null });
    queue.enqueue({ id: 'a1', runId: 'run_123', priority: PacketPriority.MEDIUM, type: 'AI_CHUNK', payload: 't1' });
    queue.enqueue({ id: 'b1', runId: 'run_456', priority: PacketPriority.MEDIUM, type: 'AI_CHUNK', payload: 't2' });
    queue.enqueue({ id: 'a2', runId: 'run_123', priority: PacketPriority.MEDIUM, type: 'AI_CHUNK', payload: 't3' });
    queue.enqueue({ id: 'h1', priority: PacketPriority.HIGH, type: 'CHAT_MSG', payload: 'human' });

    assert.equal(queue.size(), 5);

    const prunedCount = queue.pruneByRunId('run_123');
    assert.equal(prunedCount, 2);
    assert.equal(queue.size(), 3);

    // Verify ordering is still intact after re-heapify
    assert.equal(queue.dequeue()?.id, 'p0'); // P0
    assert.equal(queue.dequeue()?.id, 'h1'); // P1
    assert.equal(queue.dequeue()?.id, 'b1'); // P2 (run_456)
  });

  it('should return a non-mutating ordered snapshot for telemetry inspection', () => {
    const queue = new MinHeapQueue();
    queue.enqueue({ id: 'p2', priority: PacketPriority.MEDIUM, type: 'AI_CHUNK', payload: 'c' });
    queue.enqueue({ id: 'p0', priority: PacketPriority.CRITICAL, type: 'PIPELINE_ABORTED', payload: 'a' });
    queue.enqueue({ id: 'p1', priority: PacketPriority.HIGH, type: 'CHAT_MSG', payload: 'b' });

    const snapshot = queue.toArraySnapshot();
    assert.equal(snapshot.length, 3);
    assert.equal(snapshot[0]?.id, 'p0');
    assert.equal(snapshot[1]?.id, 'p1');
    assert.equal(snapshot[2]?.id, 'p2');

    // Underlying heap should remain intact
    assert.equal(queue.size(), 3);
  });
});

describe('TrieGuardrail (Prefix Tree Content Moderation)', () => {
  it('should correctly insert and verify words in O(K) time', () => {
    const trie = new TrieGuardrail();
    trie.insert('secret_key');
    trie.insert('leak_token');

    assert.equal(trie.contains('secret_key'), true);
    assert.equal(trie.contains('leak_token'), true);
    assert.equal(trie.contains('safe_word'), false);
    assert.equal(trie.size(), 2);
  });

  it('should sanitize banned words in O(L) time and preserve clean punctuation and casing', () => {
    const trie = new TrieGuardrail();
    trie.insertBatch(['spam-link.com', 'secret_key', 'badword']);

    const text = 'Hello World! Check this spam-link.com and do not leak secret_key, please.';
    const result = trie.sanitizeText(text);

    assert.equal(
      result.sanitized,
      'Hello World! Check this *** and do not leak ***, please.'
    );
    assert.equal(result.flaggedWords.length, 2);
    assert.ok(result.flaggedWords.includes('spam-link.com'));
    assert.ok(result.flaggedWords.includes('secret_key'));
    assert.ok(typeof result.durationMicros === 'number');
    assert.ok(result.durationMicros >= 0);
  });

  it('should handle case insensitivity during sanitization', () => {
    const trie = new TrieGuardrail();
    trie.insert('forbidden');

    const result = trie.sanitizeText('This is FORBIDDEN and also Forbidden!');
    assert.equal(result.sanitized, 'This is *** and also ***!');
    assert.equal(result.flaggedWords.length, 1);
  });
});

describe('CancelablePipeline (Burst Coalescing & Abort Logic)', () => {
  it('should coalesce rapid burst messages and save API calls', async () => {
    const minHeap = new MinHeapQueue();
    const trie = new TrieGuardrail();
    const pipeline = new CancelablePipeline({
      minHeap,
      trieGuardrail: trie,
      coalesceWindowMs: 50, // fast window for unit test
      aiChunkDelayMs: 5,
    });

    const sessionId = 'test-coalesce-session';

    // Send 3 burst messages rapidly (prior to window firing)
    pipeline.handleIncomingUserMessage(sessionId, 'Message 1');
    pipeline.handleIncomingUserMessage(sessionId, 'Message 2');
    pipeline.handleIncomingUserMessage(sessionId, 'Message 3');

    const initialSnapshot = pipeline.getTelemetrySnapshot(sessionId);
    assert.equal(initialSnapshot.activeStage, 'COALESCING');
    assert.equal(initialSnapshot.coalescedBuffer.length, 3);
    assert.equal(initialSnapshot.savedApiCalls, 2); // 2 burst saves

    // Wait for the debounce window to finish execution
    await new Promise((r) => setTimeout(r, 120));

    const finalSnapshot = pipeline.getTelemetrySnapshot(sessionId);
    assert.ok(finalSnapshot.totalPipelineRuns >= 1);

    pipeline.destroy();
  });

  it('should abort active pipeline and prune queued tokens on explicit abort', async () => {
    const minHeap = new MinHeapQueue();
    const trie = new TrieGuardrail();
    const pipeline = new CancelablePipeline({
      minHeap,
      trieGuardrail: trie,
      coalesceWindowMs: 20,
      aiChunkDelayMs: 50,
    });

    const sessionId = 'test-abort-session';
    pipeline.handleIncomingUserMessage(sessionId, 'Trigger stream');

    // Wait for coalescing to expire and streaming to begin
    await new Promise((r) => setTimeout(r, 60));

    // Abort explicitly while streaming
    pipeline.abortSession(sessionId);

    const snapshot = pipeline.getTelemetrySnapshot(sessionId);
    assert.equal(snapshot.activeStage, 'ABORTED');

    // Ensure P0 abort packet was enqueued
    const top = minHeap.peek();
    assert.equal(top?.priority, PacketPriority.CRITICAL);
    assert.equal(top?.type, 'PIPELINE_ABORTED');

    pipeline.destroy();
  });
});

