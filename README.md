# SocketFlow

**A simple, real-time WebSocket engine that keeps your chat fast and stops streaming AI responses from blocking urgent messages.**

---

## What is SocketFlow?

When you chat with an AI assistant today, the server sends back responses in hundreds of tiny pieces (tokens) every second. 

In traditional servers, all messages wait in a standard first-in, first-out line. That means if an AI is typing a long answer and you send a quick message or click **"Stop"**, your message gets stuck behind hundreds of AI chunks. 

**SocketFlow fixes this.** It acts as a smart traffic controller for your WebSockets:
- Urgent human chats and "Stop" buttons jump straight to the front of the line.
- Fast, rapid-fire messages get merged so you don't waste API tokens.
- Banned words and secrets get caught instantly without slowing down your server.

---

## How It Works (In 3 Simple Steps)

### 1. Smart Priority Queue (Binary Min-Heap)
Instead of a basic first-come-first-served queue, SocketFlow uses a custom Min-Heap data structure:
- **P0 (Critical):** Stop and abort buttons. They jump immediately to the front and cancel in-flight streams.
- **P1 (High):** Human chat messages, typing indicators, and read receipts. They jump ahead of streaming AI text.
- **P2 (Medium):** Streaming AI tokens.
- **P3 (Low):** Background logs and sync frames.

### 2. Burst Message Merging (800ms Sliding Window)
Most people don't type a single long paragraph; they send quick bursts:
> *"Hey"*  
> *"Need help with checkout"*  
> *"Actually, on mobile Safari"*

Instead of triggering 3 separate, expensive LLM calls that fight each other, SocketFlow waits 800ms, merges them into one clean prompt, and runs a single query. This saves over **70% of redundant API calls**.

### 3. Microsecond Word Guardrail (Prefix Trie)
Checking messages against thousands of banned words or secret keys using loops can freeze a server. SocketFlow uses a character-by-character Prefix Tree (Trie). It scans messages in **microseconds**, no matter if your list has 10 words or 50,000 words.

---

## What is Required?

To run SocketFlow on your computer, you only need:
- **Node.js:** version 18.0 or newer
- **npm:** version 9.0 or newer
- *(Optional)* An **OpenRouter** or **OpenAI API Key** if you want to stream real AI responses (a smart built-in simulator runs out of the box if you don't have one).

---

## Quickstart Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Both Applications
Open two terminals or run them side by side:

```bash
# Terminal 1: Start the SocketFlow Engine (WebSocket server on port 8080)
npm run start:engine

# Terminal 2: Start the Studio Dashboard (Next.js web app on port 3000)
npm run start:studio
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

---

## How Other Developers Can Use SocketFlow

You can drop the engine into any existing Node.js or Express app in less than 15 lines of code:

```typescript
import { SocketFlowServer } from "socketflow-engine";

const server = new SocketFlowServer({
  port: 8080,
  coalesceWindowMs: 800, // Wait 800ms to merge rapid burst messages
  drainIntervalMs: 100,  // Smooth packet drain rate
  bannedWords: ["secret_key", "spam-link.com", "leak_token"],
});

await server.start();
console.log("SocketFlow engine listening on ws://localhost:8080");
```

---

## Command Line Tools (CLI)

SocketFlow comes with built-in terminal commands so you can test it directly:

```bash
# 1. Run the performance benchmark
npm run cli -- benchmark

# 2. Test word moderation in microseconds
npm run cli -- scan "Check secret_key and spam-link.com in text"

# 3. Simulate priority preemption in your terminal
npm run cli -- queue-sim 10

# 4. Start the engine from the command line
npm run cli -- serve --port 8080 --drain 100
```

---

## What Can You Build With This?

- **Real-Time AI Chat Applications:** Customer support desks or internal chatbots where humans and AI agents collaborate without latency hiccups.
- **Collaborative Whiteboards & Tools:** Multiplayer apps (like Figma or Notion-style editors) where urgent cursor/edit events must never wait behind heavy data syncs.
- **Cancelable Agent Workflows:** Complex multi-step AI pipelines that need to halt instantly when a user changes their mind.

---

## Performance Summary

| Test Case | Naive Standard Approach | SocketFlow Implementation | Result |
| :--- | :--- | :--- | :--- |
| **Queue Scheduling (50,000 packets)** | Array.sort() (~4,000 ms) | Binary Min-Heap (**26 ms**) | **154x faster** |
| **Content Moderation (10,000 messages)** | Regex Loop (~2,650 ms) | Prefix Trie (**33 ms**) | **80x faster** |
| **Rapid User Burst Chatting** | 3 separate LLM runs | 800ms Coalescer (1 run) | **72% token savings** |

---

## License

MIT License. Free to use for personal, academic, and production projects.
