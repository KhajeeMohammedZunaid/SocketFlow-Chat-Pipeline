/**
 * SocketFlow Engine - Trie Guardrail (Prefix Tree)
 * 
 * Clean-room implementation of a streaming prefix-tree for O(L) content moderation.
 * Eliminates O(N * M) event-loop blocking from regex or .includes() scans.
 * 
 * Features:
 *   1. O(L) scan and sanitization where L is the input string length
 *   2. Independent of dictionary size (whether 10 or 50,000 banned patterns)
 *   3. Microsecond-resolution execution profiling using performance.now()
 *   4. Preserves non-flagged text casing and punctuation while redacting matches with '***'
 */

import { TrieSanitizeResult } from '../types.js';

export class TrieNode {
  public children: Map<string, TrieNode> = new Map();
  public isEndOfWord: boolean = false;
  public wordLength: number = 0;
  public originalWord?: string;
}

export class TrieGuardrail {
  private root: TrieNode = new TrieNode();
  private patternCount: number = 0;

  /**
   * Inserts a banned word/pattern into the trie.
   * Time Complexity: O(K) where K is pattern length
   */
  public insert(word: string): void {
    const trimmed = word.trim();
    if (!trimmed) return;

    const normalized = trimmed.toLowerCase();
    let current = this.root;

    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i]!;
      let child = current.children.get(char);
      if (!child) {
        child = new TrieNode();
        current.children.set(char, child);
      }
      current = child;
    }

    if (!current.isEndOfWord) {
      current.isEndOfWord = true;
      current.wordLength = normalized.length;
      current.originalWord = trimmed;
      this.patternCount++;
    }
  }

  /**
   * Batch inserts multiple words into the trie.
   */
  public insertBatch(words: string[]): void {
    for (const word of words) {
      this.insert(word);
    }
  }

  /**
   * Checks whether a word exists in the trie.
   * Time Complexity: O(K) where K is word length
   */
  public contains(word: string): boolean {
    const normalized = word.trim().toLowerCase();
    let current = this.root;

    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i]!;
      const child = current.children.get(char);
      if (!child) return false;
      current = child;
    }

    return current.isEndOfWord;
  }

  /**
   * Scans input text and replaces matching banned words with '***'.
   * Character-by-character traversal guarantees O(L) time complexity,
   * avoiding event-loop stalling under heavy concurrency.
   * 
   * Measures precise execution duration in microseconds (us).
   */
  public sanitizeText(input: string): TrieSanitizeResult {
    const startTime = performance.now();
    const flaggedSet = new Set<string>();
    const inputLength = input.length;
    let sanitized = '';
    let i = 0;

    while (i < inputLength) {
      let current: TrieNode | undefined = this.root;
      let longestMatchEnd = -1;
      let matchedWord: string | undefined;

      // Probe trie starting at current index
      for (let j = i; j < inputLength; j++) {
        const char = input[j]!.toLowerCase();
        current = current.children.get(char);

        if (!current) {
          break;
        }

        if (current.isEndOfWord) {
          longestMatchEnd = j;
          matchedWord = current.originalWord;
        }
      }

      if (longestMatchEnd !== -1 && matchedWord) {
        // Redact match
        sanitized += '***';
        flaggedSet.add(matchedWord);
        i = longestMatchEnd + 1;
      } else {
        // Keep clean character
        sanitized += input[i];
        i++;
      }
    }

    const durationMicros = (performance.now() - startTime) * 1000;

    return {
      sanitized,
      flaggedWords: Array.from(flaggedSet),
      durationMicros,
    };
  }

  /**
   * Returns total count of banned patterns registered.
   */
  public size(): number {
    return this.patternCount;
  }

  /**
   * Clears the entire trie.
   */
  public clear(): void {
    this.root = new TrieNode();
    this.patternCount = 0;
  }
}

