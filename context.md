# ULTIMATE MASTER ARCHITECTURAL PROMPT: SocketFlow (`socketflow-engine` + `socketflow-studio`)
**A Zero-Dependency Priority-Queue WebSocket Multiplexer, Prefix-Tree Guardrail & Cancelable AI Agent Pipeline Engine for Node.js & Next.js**

---

## 1. ROLE, CONTEXT & OBJECTIVE
You are a Staff Systems & Full-Stack Engineer specializing in Node.js runtime internals, TypeScript, WebSockets (`ws`), Next.js (App Router), and foundational Data Structures & Algorithms (DSA).

We are engineering **SocketFlow** from the ground up as a flagship engineering portfolio project targeting top-tier product/systems companies (specifically Trilogy Innovations / CodeNation, which evaluates candidates on deep systems thinking, algorithmic efficiency, and tools that solve genuine developer bottlenecks rather than standard CRUD apps).

- **Constraint 1 (Pure TypeScript/Node.js Stack):** Use ONLY Node.js, TypeScript, raw WebSockets (`ws`), and Next.js. NO Python, NO FastAPI, and NO external queue/trie/caching libraries.
- **Constraint 2 (100% Clean-Room DSA Implementation):** Every data structure (Binary Min-Heap, Prefix Trie, Sliding-Window Debouncer + `AbortController` State Machine) must be written from scratch in pure TypeScript with explicit pointer/index math to guarantee zero plagiarism and full mastery during technical interviews.
- **Constraint 3 (Headless Core & State Hooks Only — No UI Styling Details):** Do NOT spend tokens generating CSS, colors, styling themes, or visual layout specifications. I will design and build the UI myself. For the Next.js (`apps/studio`) workspace, provide ONLY the core TypeScript WebSocket client hook (`useSocketFlow.ts`), typed state containers, and raw functional trigger functions so I can wire them into my own custom UI components.

---

## 2. THE 3 REAL-WORLD NODE.JS & WEBSOCKET LOOPHOLES WE SOLVE

### Loophole 1: Head-of-Line (HoL) Blocking in Real-Time WebSocket Chat + AI Streaming
- **The Problem:** Standard Node.js WebSocket servers (`ws`, `Socket.IO`) push messages into the socket send buffer in naive **FIFO (First-In-First-Out)** order. In modern apps where AI agents stream responses at 50–100 token chunks per second inside a chat room, urgent real-time events—such as human-to-human chat messages, typing indicators, read receipts, or a user clicking "Stop Generating"—get trapped behind hundreds of queued AI token chunks. Furthermore, sorting an array of queued packets via `Array.prototype.sort()` on every insert costs $O(N \log N)$ and causes V8 Garbage Collection churn.
- **Our DSA Solution:** A custom **Binary Min-Heap Priority Queue (`MinHeapQueue.ts`)** with sequence-number tie-breaking. Every outgoing packet is assigned a strict priority tier:
  - `P0 (CRITICAL)`: Pipeline `ABORT` / Interrupt signals, system health/heartbeat frames.
  - `P1 (HIGH)`: Human-to-Human chat messages, live typing indicators, read receipts.
  - `P2 (MEDIUM)`: Streaming AI Agent token chunks.
  - `P3 (LOW)`: Historical message sync, analytics, and background telemetry.
  - **Complexity Gain:** Enqueue and Dequeue run in strict $O(\log N)$ time using binary heap index math (`parent = (i - 1) >> 1`, `left = (i << 1) + 1`, `right = (i << 1) + 2`), ensuring `P0` and `P1` packets immediately jump ahead of `P2` token streams while maintaining strict FIFO ordering within the same priority tier via a monotonic sequence counter.

### Loophole 2: Wasted AI Pipeline Runs on Rapid-Fire ("Burst") User Texting
- **The Problem:** Real users in chat apps rarely send a single complete prompt. They text in rapid bursts over 1–2 seconds (e.g., Message 1: *"Hey"* -> 300ms later Message 2: *"Need help with checkout"* -> 400ms later Message 3: *"Wait, on mobile Safari"*). A standard WebSocket listener triggers 3 separate, parallel LLM agent pipelines—wasting 3x the API tokens, spiking server CPU, and streaming 3 conflicting, out-of-order responses back to the client.
- **Our DSA Solution:** A **Sliding-Window Coalescing & Cancelable 3-Stage Pipeline (`CancelablePipeline.ts`)** powered by Node's native `AbortController`.
  - When a user sends a message, it enters an **800ms Sliding Window Buffer**.
  - If a subsequent message arrives while the 800ms window is open—OR while an existing 3-stage pipeline (`Stage 1: Trie Guardrail -> Stage 2: Context Builder -> Stage 3: Token Streamer`) is actively executing—the engine immediately triggers `activeAbortController.abort("USER_BURST_INTERRUPT")`, halts the in-flight stream at the exact token boundary, purges orphaned AI token chunks from the `MinHeapQueue`, coalesces (merges) the previous uncommitted prompt with the new message (`"Hey | Need help with checkout | Wait, on mobile Safari"`), increments the `savedApiCalls` counter, and restarts a single clean pipeline execution.

### Loophole 3: $O(N \times M)$ Event-Loop Blocking During Content Moderation & Guardrail Scans
- **The Problem:** Scanning every incoming chat message and every outgoing AI token stream against 1,000+ banned words, profanity lists, spam links, or secret key prefixes using `.includes()` or regex loops takes $O(N \times M)$ time and blocks the single-threaded Node.js event loop under load.
- **Our DSA Solution:** A custom **Prefix Tree / Trie (`TrieGuardrail.ts`)** with character-by-character pointer traversal.
  - **Complexity Gain:** Scans and redacts restricted words in $O(L)$ time (where $L$ is the length of the message), completely independent of whether the dictionary contains 10 or 50,000 banned patterns. Tracks exact execution latency in microseconds ($\mu s$) using `performance.now()`.

---

## 3. HOW OTHER DEVELOPERS USE THIS PROJECT (3 CONSUMPTION MODES)

To make this an authentic developer tool that stands out in engineering interviews, structure it as a **Turborepo / Workspaces Monorepo** with three consumption modes:

### Mode 1: The Core Installable NPM Package (`socketflow-engine`)
Any developer building a Node.js WebSocket chat or AI assistant app can run `npm install socketflow-engine` and import the server wrapper into their existing `ws` or Express/Node backend in 10 lines of code:

```typescript
import { SocketFlowServer, PacketPriority } from "socketflow-engine";

const server = new SocketFlowServer({
  port: 8080,
  coalesceWindowMs: 800,
  drainIntervalMs: 20,
  bannedWords: ["secret_key", "spam-link.com", "profanity", "leak_token"],
});

server.start();
```

### Mode 2: Standalone Imported Data Structures
Developers can import the raw TypeScript DSA classes directly for their own custom backend pipelines:

```typescript
import { MinHeapQueue, TrieGuardrail, CancelablePipeline } from "socketflow-engine";
```

### Mode 3: CLI Benchmark Runner & Next.js Headless Client Hook (`apps/studio`)
- **CLI Benchmark (`npm run benchmark`):** A terminal benchmark script that executes 50,000 priority insertions and 20,000 moderation scans, printing an ASCII comparison table proving the speedup of `MinHeapQueue` vs. `Array.sort()` and `TrieGuardrail` vs. Regex loops.
- **Next.js Client SDK Hook (`useSocketFlow.ts`):** Exposes real-time WebSocket state, heap snapshots, pipeline stage status, and simulation actions (`sendBurstMessages()`, `injectPriorityMessage()`, `toggleNetworkThrottle()`, `abortActiveStream()`) that I will bind to my own custom Next.js UI.

---

## 4. REFERENCE GITHUB REPOSITORIES (ARCHITECTURAL STUDY & ZERO-PLAGIARISM PROTOCOL)
Instead of copying any repository, we use architectural reverse-engineering: studying how established open-source tools handle state under the hood, then building a clean-room implementation with specialized features they lack:
- **`websockets/ws`:** Used as our lightweight Node.js WebSocket transport base instead of heavy Socket.IO so our custom `MinHeapQueue` and backpressure drain loop directly control packet emission.
- **`sindresorhus/p-queue`:** Studied for how priority concurrency is structured in TypeScript, then replaced with our own custom binary `MinHeapQueue.ts` from scratch with sequence-number tie-breaking and mid-stream heap pruning.
- **`datastructures-js/trie`:** Referenced for how a standard Trie node (`children: Map<string, TrieNode>`, `isEndOfWord: boolean`) is structured, and adapted into a streaming middleware step (`TrieGuardrail.ts`) with microsecond profiling.

---

## 5. MONOREPO FOLDER ARCHITECTURE

```plaintext
socketflow/
├── package.json                       # Workspaces root + scripts (dev, build, test, benchmark)
├── tsconfig.base.json                 # Strict TypeScript compiler configuration
├── README.md                          # Architecture diagrams, 10-line SDK quickstart, benchmark tables
├── packages/
│   └── engine/                        # Core NPM Package ("socketflow-engine")
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts                        # Public SDK exports
│       │   ├── types.ts                        # Complete TypeScript interfaces & enums
│       │   ├── dsa/
│       │   │   ├── MinHeapQueue.ts             # Custom Binary Min-Heap with O(log N) operations & heap pruning
│       │   │   └── TrieGuardrail.ts            # Custom Prefix Tree with O(L) redaction & microsecond timer
│       │   ├── pipeline/
│       │   │   └── CancelablePipeline.ts       # 3-Stage Agent Pipeline + 800ms Coalescer + AbortController
│       │   ├── server/
│       │   │   └── SocketFlowServer.ts         # Node.js `ws` Server + Configurable Drain Loop + Telemetry Emitter
│       │   └── benchmark/
│       │       └── cli-benchmark.ts            # Terminal benchmark: MinHeap vs Array.sort & Trie vs Regex
│       └── tests/
│           └── engine.test.ts                  # Comprehensive unit tests for Heap, Trie, and Pipeline
└── apps/
    └── studio/                        # Next.js App Router (Headless Logic & State Hook Layer Only)
        ├── package.json
        ├── tsconfig.json
        └── src/
            └── hooks/
                └── useSocketFlow.ts            # Complete WebSocket hook + simulation triggers for custom UI
```

---

## 6. DETAILED TECHNICAL & ALGORITHMIC SPECIFICATIONS

### 6.1 `packages/engine/src/types.ts`
Define strict TypeScript interfaces and enums:
- `enum PacketPriority { CRITICAL = 0, HIGH = 1, MEDIUM = 2, LOW = 3 }`
- `interface QueuePacket<T = unknown>`:
  - `id: string`
  - `runId?: string` (links AI token chunks to a specific pipeline execution so aborted runs can be purged from the heap)
  - `priority: PacketPriority`
  - `sequenceId: number` (auto-incremented integer to guarantee strict FIFO within the same priority tier)
  - `timestamp: number`
  - `type: 'CHAT_MSG' | 'TYPING' | 'READ_RECEIPT' | 'AI_CHUNK' | 'AI_DONE' | 'PIPELINE_ABORTED' | 'TELEMETRY'`
  - `payload: T`
- `type PipelineStage = 'IDLE' | 'COALESCING' | 'STAGE_1_TRIE' | 'STAGE_2_CONTEXT' | 'STAGE_3_STREAMING' | 'ABORTED' | 'COMPLETED'`
- `interface TelemetrySnapshot`:
  - `heapQueueSnapshot: QueuePacket[]`
  - `activeStage: PipelineStage`
  - `coalescedBuffer: string[]`
  - `savedApiCalls: number`
  - `totalPipelineRuns: number`
  - `lastTrieScanMicros: number`
  - `flaggedWords: string[]`
  - `drainIntervalMs: number`

### 6.2 `packages/engine/src/dsa/MinHeapQueue.ts`
- Do NOT use `Array.prototype.sort()`. Write explicit `bubbleUp(index: number)` and `sinkDown(index: number)` methods using binary heap index arithmetic (`Math.floor((i - 1) / 2)` for parent, `2 * i + 1` for left child, `2 * i + 2` for right child).
- Comparator `private compare(a: QueuePacket, b: QueuePacket): number`:
  - `if (a.priority !== b.priority) return a.priority - b.priority;`
  - `return a.sequenceId - b.sequenceId;` (strictly preserves insertion order for identical priorities).
- **Required Methods:**
  - `enqueue(packet: Omit<QueuePacket, 'sequenceId' | 'timestamp'>): QueuePacket`
  - `dequeue(): QueuePacket | undefined`
  - `peek(): QueuePacket | undefined`
  - `pruneByRunId(runId: string): number` — Removes all queued `AI_CHUNK` packets matching an aborted `runId` and re-heapifies in $O(N)$ time so stale AI tokens are never sent after an interrupt.
  - `size(): number`
  - `toArraySnapshot(): QueuePacket[]` — Returns a non-mutating ordered copy of current heap items for live telemetry inspection.

### 6.3 `packages/engine/src/dsa/TrieGuardrail.ts`
- Implement `TrieNode` using `children: Map<string, TrieNode> = new Map()` and `isEndOfWord: boolean = false`.
- **Required Methods:**
  - `insert(word: string): void`
  - `insertBatch(words: string[]): void`
  - `contains(word: string): boolean`
  - `sanitizeText(input: string): { sanitized: string; flaggedWords: string[]; durationMicros: number }`:
    - Uses `performance.now()` to measure exact scan time in microseconds ($\mu s$).
    - Traverses characters in $O(L)$ time, replacing matched banned words/tokens with `***` while preserving original casing and punctuation on clean text.

### 6.4 `packages/engine/src/pipeline/CancelablePipeline.ts`
- Maintain a `Map<string, SessionState>` keyed by `roomId` or `userId`.
- Each `SessionState` tracks: `pendingMessages: string[]`, `debounceTimer: NodeJS.Timeout | null`, `activeAbortController: AbortController | null`, `activeRunId: string | null`, `savedApiCallsCount: number`, and `totalPipelineRuns: number`.
- **Execution Flow on `handleIncomingUserMessage(sessionId: string, rawText: string)`:**
  1. Push `rawText` into `pendingMessages`.
  2. **Mid-Stream Interrupt Check:** If `activeAbortController` exists (an AI pipeline is currently running Stage 2 or streaming Stage 3), call `activeAbortController.abort("BURST_INTERRUPT")`, call `minHeap.pruneByRunId(activeRunId)` to wipe any un-drained AI chunks from the queue, increment `savedApiCallsCount`, enqueue a `P0 (CRITICAL)` `PIPELINE_ABORTED` event, and emit telemetry.
  3. **Sliding-Window Coalesce Check:** If `debounceTimer` is already active, `clearTimeout(debounceTimer)` and increment `savedApiCallsCount` (since two rapid messages were coalesced prior to pipeline launch).
  4. Reset the 800ms sliding-window debounce timer and emit `activeStage = 'COALESCING'`.
  5. **When the 800ms window completes without interruption:**
     - Join `pendingMessages.join(" | ")` into a unified prompt and clear `pendingMessages`.
     - Instantiate a fresh `AbortController` and `runId`.
     - **Stage 1 (`STAGE_1_TRIE`):** Run `TrieGuardrail.sanitizeText(mergedPrompt)`. Record `durationMicros` and `flaggedWords`. Check `if (signal.aborted) return`.
     - **Stage 2 (`STAGE_2_CONTEXT`):** Assemble conversation sliding window context. Check `if (signal.aborted) return`.
     - **Stage 3 (`STAGE_3_STREAMING`):** Stream response chunks into `MinHeapQueue` with `PacketPriority.MEDIUM (P2)` and `runId`, checking `signal.aborted` before every single token emission.

### 6.5 `packages/engine/src/server/SocketFlowServer.ts`
- Wraps Node.js `WebSocketServer` (`ws`).
- Runs a configurable packet drain loop (`drainIntervalMs`, default `20ms`, dynamically adjustable at runtime to `250ms–300ms` to simulate slow network backpressure).
- On every tick of the drain loop, dequeues the highest-priority packet from `MinHeapQueue` (`P0 -> P1 -> P2 -> P3`), sends it over the open WebSocket connection, and broadcasts updated `TelemetrySnapshot` frames.
- **Handles incoming client commands:**
  - `SEND_CHAT` (triggers `CancelablePipeline` or direct `P1` human broadcast)
  - `SEND_TYPING` / `SEND_READ_RECEIPT` (enqueues directly at `PacketPriority.HIGH (P1)`)
  - `ABORT_PIPELINE` (triggers immediate `P0` cancellation and heap pruning)
  - `SET_DRAIN_THROTTLE` (adjusts `drainIntervalMs` on the fly so the user can test `P1` packets jumping ahead of `P2` AI chunks in the queue)

### 6.6 `packages/engine/src/benchmark/cli-benchmark.ts`
- A standalone script executable via `npm run benchmark` that runs three automated tests and prints a formatted console table:
  - **Test 1 (Queue Scheduling — 50,000 Prioritized Packets):** Naive Array `.push()` + `.sort()` (~1,400ms+) vs. `MinHeapQueue` (~10ms).
  - **Test 2 (Moderation Guardrail — 10,000 Messages across 2,000 Banned Patterns):** Regex / `.includes()` Loop (~380ms+) vs. `TrieGuardrail` (~9ms).
  - **Test 3 (Burst Coalescing Simulation):** 100 rapid-fire burst messages coalesced into ~28 clean pipeline executions (72% LLM API call & token savings).

### 6.7 `apps/studio/src/hooks/useSocketFlow.ts` (Headless Next.js State Hook Only)
- Provide ONLY the complete, strictly typed React hook (`useSocketFlow`) with zero UI/CSS opinions.
- **The hook manages the WebSocket connection and returns:**
  - `messages`: Ordered array of chat messages, coalesced prompt markers, and streaming AI responses.
  - `telemetry`: Live `TelemetrySnapshot` (`heapQueueSnapshot`, `activeStage`, `coalescedBuffer`, `savedApiCalls`, `lastTrieScanMicros`, `flaggedWords`, `drainIntervalMs`).
  - `actions`:
    - `sendMessage(text: string): void`
    - `sendPriorityHumanSignal(type: 'TYPING' | 'READ_RECEIPT' | 'URGENT_CHAT', text?: string): void`
    - `simulateRapidBurst(messages?: string[], intervalMs?: number): void` (fires 3 rapid messages 300ms apart to trigger coalescing & abort logic)
    - `abortCurrentStream(): void`
    - `setNetworkDrainRate(intervalMs: number): void`

---

## 7. 4-DAY GIT COMMIT ROADMAP (AUTHENTIC INCREMENTAL ENGINEERING HISTORY)
Structure and generate the codebase following this exact 4-day git workflow:

### Day 1: Core Data Structures & Unit Test Suite (Branch: `feat/core-dsa`)
- **Commit 1:** `chore: initialize monorepo workspaces and strict typescript configuration`
- **Commit 2:** `feat(dsa): implement binary MinHeapQueue with O(log N) priority scheduling, FIFO tie-breaking, and runId pruning`
- **Commit 3:** `feat(dsa): implement TrieGuardrail prefix tree with O(L) sanitization and microsecond profiling`
- **Commit 4:** `test(dsa): add unit test suite for heap priority preemption and trie redaction`

### Day 2: Cancelable Agent Pipeline & WebSocket Multiplexer (Branch: `feat/ws-pipeline`)
- **Commit 5:** `feat(pipeline): build 3-stage CancelablePipeline with 800ms sliding window and AbortController`
- **Commit 6:** `feat(server): integrate MinHeapQueue, TrieGuardrail, and Pipeline into Node.js ws server with dynamic drain throttling`
- **Commit 7:** `feat(sdk): export clean public API for socketflow-engine npm package`

### Day 3: Headless Next.js Client Hook & State Bridge (Branch: `feat/client-sdk-hook`)
- **Commit 8:** `feat(studio-hook): implement headless useSocketFlow React hook with real-time telemetry state and burst/throttle triggers`

### Day 4: CLI Benchmarks & System Architecture Documentation (Branch: `docs/benchmarks-and-readme`)
- **Commit 9:** `perf(benchmark): add CLI benchmark script comparing FIFO Array.sort vs MinHeapQueue and Regex vs Trie`
- **Commit 10:** `docs(readme): add Mermaid system architecture diagrams, 10-line NPM SDK usage guide, and benchmark metrics`

---

## 8. EXECUTION INSTRUCTIONS FOR THE AI ASSISTANT
- Do NOT write placeholder comments like `// implement logic here` or skip methods. Write 100% complete, production-ready, strictly typed TypeScript code.
- Do NOT generate any HTML/JSX layout or Tailwind CSS components—only generate the backend engine, unit tests, CLI benchmark, headless `useSocketFlow.ts` hook, and the technical `README.md`.
- Execute in two clean phases so no file is truncated:
  - **PHASE 1 (Generate Immediately Now):** Root `package.json`, `tsconfig.base.json`, `packages/engine/package.json`, `packages/engine/src/types.ts`, `packages/engine/src/dsa/MinHeapQueue.ts`, `packages/engine/src/dsa/TrieGuardrail.ts`, and `packages/engine/tests/engine.test.ts` (Day 1 Deliverables).
  - **PHASE 2 (Generate immediately after I reply "Next"):** `packages/engine/src/pipeline/CancelablePipeline.ts`, `packages/engine/src/server/SocketFlowServer.ts`, `packages/engine/src/index.ts`, `packages/engine/src/benchmark/cli-benchmark.ts`, `apps/studio/src/hooks/useSocketFlow.ts`, and `README.md` (Day 2, Day 3, and Day 4 Deliverables).