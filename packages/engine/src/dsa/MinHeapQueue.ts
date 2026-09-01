/**
 * SocketFlow Engine - Binary Min-Heap Priority Queue
 * 
 * Clean-room implementation using explicit binary heap index arithmetic:
 *   - Parent:    (i - 1) >> 1
 *   - Left Child:  (i << 1) + 1
 *   - Right Child: (i << 1) + 2
 * 
 * Guarantees:
 *   1. O(log N) Enqueue & Dequeue operations
 *   2. Strict FIFO ordering for equal priorities via monotonic sequenceId tie-breaking
 *   3. O(N) mid-stream heap pruning and re-heapification by runId
 *   4. Zero external queue or heap library dependencies
 */

import { QueuePacket } from '../types.js';

export class MinHeapQueue {
  private heap: QueuePacket[] = [];
  private nextSequenceId: number = 0;

  /**
   * Comparator function:
   * 1. Primary sort: packet priority (CRITICAL: 0 < HIGH: 1 < MEDIUM: 2 < LOW: 3)
   * 2. Secondary tie-breaker: monotonic sequenceId (strictly preserves FIFO order)
   */
  private compare(a: QueuePacket, b: QueuePacket): number {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.sequenceId - b.sequenceId;
  }

  /**
   * Swaps elements at indices i and j in the heap array
   */
  private swap(i: number, j: number): void {
    const temp = this.heap[i]!;
    this.heap[i] = this.heap[j]!;
    this.heap[j] = temp;
  }

  /**
   * Restores min-heap property by bubbling element at index up to its correct position.
   * Time Complexity: O(log N)
   */
  private bubbleUp(index: number): void {
    let current = index;
    while (current > 0) {
      const parent = (current - 1) >> 1;
      if (this.compare(this.heap[current]!, this.heap[parent]!) < 0) {
        this.swap(current, parent);
        current = parent;
      } else {
        break;
      }
    }
  }

  /**
   * Restores min-heap property by sinking element at index down to its correct position.
   * Time Complexity: O(log N)
   */
  private sinkDown(index: number): void {
    const length = this.heap.length;
    let current = index;

    while (true) {
      const left = (current << 1) + 1;
      const right = (current << 1) + 2;
      let smallest = current;

      if (left < length && this.compare(this.heap[left]!, this.heap[smallest]!) < 0) {
        smallest = left;
      }

      if (right < length && this.compare(this.heap[right]!, this.heap[smallest]!) < 0) {
        smallest = right;
      }

      if (smallest !== current) {
        this.swap(current, smallest);
        current = smallest;
      } else {
        break;
      }
    }
  }

  /**
   * Enqueues a packet into the priority queue.
   * Automatically assigns a monotonic sequenceId and timestamp.
   * Time Complexity: O(log N)
   */
  public enqueue(packet: Omit<QueuePacket, 'sequenceId' | 'timestamp'>): QueuePacket {
    const fullPacket: QueuePacket = {
      ...packet,
      sequenceId: this.nextSequenceId++,
      timestamp: Date.now(),
    };

    this.heap.push(fullPacket);
    this.bubbleUp(this.heap.length - 1);
    return fullPacket;
  }

  /**
   * Dequeues the highest priority packet from the root of the heap.
   * Time Complexity: O(log N)
   */
  public dequeue(): QueuePacket | undefined {
    if (this.heap.length === 0) {
      return undefined;
    }

    if (this.heap.length === 1) {
      return this.heap.pop();
    }

    const root = this.heap[0]!;
    const last = this.heap.pop()!;
    this.heap[0] = last;
    this.sinkDown(0);

    return root;
  }

  /**
   * Peeks at the highest priority packet without removing it.
   * Time Complexity: O(1)
   */
  public peek(): QueuePacket | undefined {
    return this.heap[0];
  }

  /**
   * Prunes all pending packets matching an aborted runId and re-heapifies in place.
   * Used when an active pipeline is aborted mid-stream to purge orphaned tokens.
   * Time Complexity: O(N)
   */
  public pruneByRunId(runId: string): number {
    const initialSize = this.heap.length;
    this.heap = this.heap.filter((packet) => packet.runId !== runId);
    const prunedCount = initialSize - this.heap.length;

    if (prunedCount > 0) {
      // Re-heapify from the lowest non-leaf node up to root in O(N) time
      for (let i = (this.heap.length >> 1) - 1; i >= 0; i--) {
        this.sinkDown(i);
      }
    }

    return prunedCount;
  }

  /**
   * Returns current count of queued packets.
   */
  public size(): number {
    return this.heap.length;
  }

  /**
   * Returns true if queue is empty.
   */
  public isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /**
   * Clears all packets from queue and resets sequenceId counter.
   */
  public clear(): void {
    this.heap = [];
    this.nextSequenceId = 0;
  }

  /**
   * Returns an ordered snapshot of current packets for telemetry inspection
   * without mutating the underlying heap.
   */
  public toArraySnapshot(): QueuePacket[] {
    return [...this.heap].sort((a, b) => this.compare(a, b));
  }
}
