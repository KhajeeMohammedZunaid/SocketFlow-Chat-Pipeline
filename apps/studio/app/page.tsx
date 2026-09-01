'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSocketFlow } from '@/hooks/useSocketFlow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default function SocketFlowStudioPage() {
  const { isConnected, messages, telemetry, activeTypingUser, actions } =
    useSocketFlow('ws://localhost:8080');

  const [inputText, setInputText] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<'openrouter' | 'openai'>('openrouter');
  const [selectedModel, setSelectedModel] = useState('openai/gpt-4o-mini');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [drainRate, setDrainRate] = useState(telemetry.drainIntervalMs || 120);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    actions.sendMessage(inputText, {
      urgent: isUrgent,
      apiKey: apiKey.trim() || undefined,
      provider,
      model: selectedModel,
    });
    setInputText('');
  };

  const handleDrainChange = (newRate: number) => {
    setDrainRate(newRate);
    actions.setNetworkDrainRate(newRate);
  };

  const stages = [
    { key: 'IDLE', label: 'Idle' },
    { key: 'COALESCING', label: 'Coalescing (800ms)' },
    { key: 'STAGE_1_TRIE', label: 'Trie Guardrail' },
    { key: 'STAGE_2_CONTEXT', label: 'Context Prep' },
    { key: 'STAGE_3_STREAMING', label: 'P2 Streaming' },
  ];

  const currentStageIndex = stages.findIndex(
    (s) => s.key === telemetry.activeStage
  );

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex flex-col select-none antialiased">
      {/* Top Header */}
      <header className="w-full bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-blue-600" />
          <h1 className="text-base font-semibold tracking-[-0.03em] text-slate-900">
            SocketFlow Studio
          </h1>
          <span className="text-xs text-slate-600 font-medium">
            Zero-Dependency Priority WebSocket Multiplexer
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Real-time LLM API Key Toggle */}
          <button
            onClick={() => setShowKeyModal(!showKeyModal)}
            className={`text-xs px-3 py-1.5 rounded font-medium transition-colors ${
              apiKey.trim().length > 5
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {apiKey.trim().length > 5 ? 'OpenRouter Active' : '+ Add API Key'}
          </button>

          {/* Connection Status Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-slate-100 text-xs font-medium text-slate-800">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-blue-600 animate-pulse' : 'bg-rose-600'
              }`}
            />
            <span>{isConnected ? 'Connected: 8080' : 'Reconnecting...'}</span>
          </div>
        </div>
      </header>

      {/* API Key Modal / Dropdown (100% In-Memory & Secure) */}
      <AnimatePresence>
        {showKeyModal && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="w-full bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4 flex-1 max-w-3xl">
              <span className="text-xs font-semibold text-slate-800 shrink-0">
                Model:
              </span>
              <select
                value={selectedModel}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedModel(val);
                  if (val.startsWith('gpt-')) {
                    setProvider('openai');
                  } else {
                    setProvider('openrouter');
                  }
                }}
                className="text-xs bg-white border border-slate-300 rounded px-2.5 py-1.5 font-medium text-slate-900 outline-none cursor-pointer"
              >
                <option value="openai/gpt-4o-mini">OpenRouter: GPT-4o mini (Default)</option>
                <option value="meta-llama/llama-3.1-8b-instruct">OpenRouter: Llama 3.1 8B</option>
                <option value="mistralai/mistral-7b-instruct">OpenRouter: Mistral 7B</option>
                <option value="gpt-4o-mini">Direct OpenAI: GPT-4o mini</option>
                <option value="gpt-4o">Direct OpenAI: GPT-4o</option>
              </select>

              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste API Key (sk-or-... or sk-...) — saved in-memory only"
                className="bg-white border-slate-300 text-xs text-slate-900 h-8 px-3 font-mono flex-1"
              />
            </div>

            <div className="flex items-center gap-2">
              {apiKey && (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => setApiKey('')}
                  className="text-xs text-rose-700 border-rose-200 hover:bg-rose-50"
                >
                  Clear Key
                </Button>
              )}
              <Button
                size="xs"
                onClick={() => setShowKeyModal(false)}
                className="bg-slate-900 text-white text-xs px-3"
              >
                Done
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Responsive Grid Layout */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ========================================================= */}
        {/* LEFT COLUMN: RESPONSIVE CHAT INTERFACE                    */}
        {/* ========================================================= */}
        <section className="lg:col-span-6 flex flex-col h-[calc(100vh-130px)] bg-slate-50 rounded-xl p-5 border border-slate-200">
          {/* Signal Action Bar */}
          <nav className="flex items-center justify-between pb-3.5 border-b border-slate-200">
            <h3 className="text-xs font-medium text-slate-700 tracking-[-0.045em]">
              Interactive Signals
            </h3>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => actions.simulateRapidBurst()}
                className="bg-white border-slate-300 hover:bg-blue-50 text-slate-800 text-xs font-medium h-7 px-3 shadow-none"
                title="Fires 3 rapid messages within 300ms to trigger the 800ms coalescer"
              >
                Burst (3 msgs)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  actions.sendPriorityHumanSignal(
                    'URGENT_CHAT',
                    'URGENT: Human preemption signal jumping the queue!'
                  )
                }
                className="bg-white border-amber-300 text-amber-900 hover:bg-amber-50 text-xs font-medium h-7 px-3 shadow-none"
                title="Direct P1 High Priority chat frame"
              >
                Send P1 Urgent
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => actions.abortCurrentStream()}
                className="bg-white border-rose-300 text-rose-800 hover:bg-rose-50 text-xs font-medium h-7 px-3 shadow-none"
                title="P0 ABORT preemption"
              >
                Abort (P0)
              </Button>
            </div>
          </nav>

          {/* Messages Stream Scroller (No ugly scrollbars) */}
          <article className="flex-1 overflow-y-auto py-4 space-y-3 pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <p className="text-sm font-medium text-slate-700">
                  Ready for input
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Type a prompt or click &quot;Burst (3 msgs)&quot; to watch priority queue preemption live.
                </p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex flex-col p-3.5 rounded-lg text-sm border ${
                      msg.type === 'ABORT_NOTICE'
                        ? 'bg-rose-50 text-rose-950 border-rose-300'
                        : msg.sender.includes('Urgent')
                        ? 'bg-amber-50 text-amber-950 border-amber-300'
                        : msg.sender === 'SocketFlow Agent'
                        ? 'bg-blue-50 text-blue-950 border-blue-200'
                        : 'bg-white text-slate-900 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs tracking-tight text-slate-900">
                          {msg.sender}
                        </span>
                        {msg.priority !== undefined && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                              msg.priority === 0
                                ? 'bg-rose-200 text-rose-900'
                                : msg.priority === 1
                                ? 'bg-amber-200 text-amber-900'
                                : msg.priority === 2
                                ? 'bg-blue-200 text-blue-900'
                                : 'bg-slate-200 text-slate-900'
                            }`}
                          >
                            P{msg.priority}
                          </span>
                        )}
                      </div>
                      <time className="text-xs text-slate-600 font-mono">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </time>
                    </div>

                    <p className="whitespace-pre-wrap leading-relaxed text-sm text-slate-900 font-normal">
                      {msg.text}
                      {msg.isStreaming && (
                        <span className="inline-block w-2 h-4 bg-blue-600 ml-1 animate-pulse align-middle" />
                      )}
                    </p>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            <div ref={messagesEndRef} />
          </article>

          {/* Typing Indicator */}
          {activeTypingUser && (
            <div className="text-xs text-blue-700 font-medium py-1 px-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
              <span>{activeTypingUser} is typing...</span>
            </div>
          )}

          {/* Input Form */}
          <form
            onSubmit={handleSend}
            className="pt-3 border-t border-slate-200 flex flex-col gap-2.5"
          >
            <div className="flex items-center gap-2">
              <Input
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  actions.sendPriorityHumanSignal('TYPING');
                }}
                placeholder="Type prompt or chat message..."
                className="bg-white border-slate-300 text-sm h-10 px-3.5 text-slate-900 focus-visible:ring-1 focus-visible:ring-blue-600"
              />
              <Button
                type="submit"
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm h-10 px-5 font-medium shrink-0"
              >
                Send
              </Button>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-700 px-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isUrgent}
                  onChange={(e) => setIsUrgent(e.target.checked)}
                  className="rounded border-slate-400 text-blue-600 w-4 h-4 cursor-pointer"
                />
                <span className={isUrgent ? 'text-amber-900 font-semibold' : 'text-slate-800'}>
                  Send as Urgent (P1 Preemption)
                </span>
              </label>

              <span className="text-xs text-slate-600 font-mono">
                Press Enter to dispatch
              </span>
            </div>
          </form>
        </section>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: HIGH-CONTRAST ENGINE MECHANICS FLOWMAP      */}
        {/* ========================================================= */}
        <aside className="lg:col-span-6 flex flex-col h-[calc(100vh-130px)] gap-5 overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {/* SECTION 1: 3-Stage State Machine Flowmap */}
          <section className="bg-slate-50 rounded-xl p-5 border border-slate-200 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-900 tracking-[-0.045em]">
                Pipeline State Machine
              </h3>
              <Badge
                variant="outline"
                className={`text-xs font-mono font-bold px-2.5 py-0.5 border-transparent ${
                  telemetry.activeStage === 'IDLE'
                    ? 'bg-slate-200 text-slate-800'
                    : telemetry.activeStage === 'ABORTED'
                    ? 'bg-rose-200 text-rose-900'
                    : telemetry.activeStage === 'COMPLETED'
                    ? 'bg-emerald-200 text-emerald-900'
                    : 'bg-blue-600 text-white animate-pulse'
                }`}
              >
                {telemetry.activeStage}
              </Badge>
            </div>

            {/* Stage Steps */}
            <div className="grid grid-cols-5 gap-2">
              {stages.map((st, idx) => {
                const isActive = telemetry.activeStage === st.key;
                const isPassed =
                  currentStageIndex > idx &&
                  telemetry.activeStage !== 'ABORTED';

                return (
                  <div
                    key={st.key}
                    className={`flex flex-col items-center text-center p-2.5 rounded text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white font-semibold'
                        : isPassed
                        ? 'bg-blue-100 text-blue-900'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    <span className="font-mono text-[11px] mb-0.5 opacity-80">
                      0{idx + 1}
                    </span>
                    <span className="truncate w-full">{st.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Active Coalescing Text Buffer */}
            {telemetry.coalescedBuffer.length > 0 && (
              <div className="p-3 rounded bg-white border border-slate-200 text-xs">
                <span className="text-xs font-semibold text-slate-700 block mb-1">
                  Coalesced Prompt (800ms Buffer):
                </span>
                <p className="font-mono text-blue-700 text-xs font-medium truncate">
                  {telemetry.coalescedBuffer.join(' | ')}
                </p>
              </div>
            )}
          </section>

          {/* SECTION 2: Binary Min-Heap Priority Queue Live View */}
          <section className="bg-slate-50 rounded-xl p-5 border border-slate-200 flex-1 flex flex-col min-h-[260px]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-slate-900 tracking-[-0.045em]">
                  Binary Min-Heap Priority Queue
                </h3>
                <span className="text-xs font-mono text-slate-700">
                  O(log N)
                </span>
              </div>
              <span className="text-xs font-mono font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                {telemetry.heapQueueSnapshot.length} queued
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {telemetry.heapQueueSnapshot.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-white rounded border border-slate-200 text-slate-700">
                  <span className="text-sm font-semibold text-slate-900">
                    Queue is clear
                  </span>
                  <span className="text-xs text-slate-600 mt-1">
                    Packets drain every {telemetry.drainIntervalMs}ms. Click &quot;Burst&quot; or start a stream to watch packets queue and preempt.
                  </span>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {telemetry.heapQueueSnapshot.map((packet, idx) => (
                    <motion.div
                      key={packet.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 6 }}
                      transition={{ duration: 0.15 }}
                      className={`flex items-center justify-between p-2.5 rounded text-xs font-medium border ${
                        packet.priority === 0
                          ? 'bg-rose-100 text-rose-950 border-rose-400'
                          : packet.priority === 1
                          ? 'bg-amber-100 text-amber-950 border-amber-400'
                          : packet.priority === 2
                          ? 'bg-blue-100 text-blue-950 border-blue-300'
                          : 'bg-white text-slate-900 border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-bold text-slate-900 w-5">
                          #{idx + 1}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[11px] font-mono font-bold px-2 py-0.5 border-transparent bg-white text-slate-900"
                        >
                          P{packet.priority}
                        </Badge>
                        <span className="font-mono text-xs font-semibold text-slate-900">
                          {packet.type}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-700 font-mono">
                        {packet.runId && (
                          <span className="truncate max-w-[100px] text-slate-800">
                            {packet.runId}
                          </span>
                        )}
                        <span className="text-slate-900 font-semibold">
                          seq:{packet.sequenceId}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </section>

          {/* SECTION 3: Telemetry HUD & Backpressure Throttler */}
          <section className="bg-slate-50 rounded-xl p-5 border border-slate-200 flex flex-col gap-4">
            <h3 className="text-xs font-semibold text-slate-900 tracking-[-0.045em]">
              Real-Time Algorithmic Metrics
            </h3>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white p-3 rounded border border-slate-200">
                <span className="text-xs font-semibold text-slate-700 block mb-1">
                  Saved LLM Calls
                </span>
                <span className="text-lg font-bold text-blue-600 font-mono">
                  {telemetry.savedApiCalls}
                </span>
              </div>

              <div className="bg-white p-3 rounded border border-slate-200">
                <span className="text-xs font-semibold text-slate-700 block mb-1">
                  Trie Scan Time
                </span>
                <span className="text-lg font-bold text-slate-900 font-mono">
                  {telemetry.lastTrieScanMicros.toFixed(1)} µs
                </span>
              </div>

              <div className="bg-white p-3 rounded border border-slate-200">
                <span className="text-xs font-semibold text-slate-700 block mb-1">
                  Pipeline Runs
                </span>
                <span className="text-lg font-bold text-slate-900 font-mono">
                  {telemetry.totalPipelineRuns}
                </span>
              </div>
            </div>

            {/* Redacted Words Badges */}
            {telemetry.flaggedWords.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap text-xs bg-white p-2.5 rounded border border-slate-200">
                <span className="text-xs font-semibold text-rose-800">
                  Trie Redacted:
                </span>
                {telemetry.flaggedWords.map((word) => (
                  <Badge
                    key={word}
                    variant="outline"
                    className="bg-rose-100 text-rose-900 border-rose-300 text-xs px-2 py-0.5 font-medium"
                  >
                    {word}
                  </Badge>
                ))}
              </div>
            )}

            <Separator className="bg-slate-200" />

            {/* Network Drain Throttler */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">
                  Network Drain Throttle
                </span>
                <span className="font-mono text-xs font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {drainRate} ms
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-700 font-mono">
                  20ms (Fast)
                </span>
                <input
                  type="range"
                  min="20"
                  max="400"
                  step="20"
                  value={drainRate}
                  onChange={(e) => handleDrainChange(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <span className="text-xs font-medium text-slate-700 font-mono">
                  400ms (Slow)
                </span>
              </div>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
