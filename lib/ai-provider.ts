/**
 * Unified AI Provider Interface
 * Uses a provider registry (strategy pattern) with auto-fallback: Groq → Gemini → Ollama
 */

import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ── Types ─────────────────────────────────────────────────────────────────────
export type Message = { role: "system" | "user" | "assistant"; content: string };

interface AIProviderImpl {
  chat(messages: Message[], maxTokens: number): Promise<string>;
  generate(prompt: string, maxTokens: number): Promise<string>;
}

// ── Provider Implementations ──────────────────────────────────────────────────

const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-70b-versatile";

const geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "tinyllama";

const groqProvider: AIProviderImpl = {
  async chat(messages, maxTokens) {
    const completion = await groqClient.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: maxTokens,
      top_p: 1,
      stream: false,
    });
    return completion.choices[0]?.message?.content || "No response from AI";
  },

  async generate(prompt, maxTokens) {
    const completion = await groqClient.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: maxTokens,
      top_p: 1,
      stream: false,
    });
    return completion.choices[0]?.message?.content?.trim() || "";
  },
};

const geminiProvider: AIProviderImpl = {
  async chat(messages, maxTokens) {
    const systemMessage = messages.find(m => m.role === "system");
    const convoMessages = messages.filter(m => m.role !== "system");
    const lastMessage = convoMessages.at(-1);
    const history = convoMessages.slice(0, -1).map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const model = geminiClient.getGenerativeModel({
      model: GEMINI_MODEL,
      ...(systemMessage && { systemInstruction: systemMessage.content }),
      generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens, topP: 1 },
    });

    const chatSession = model.startChat({ history });
    const result = await chatSession.sendMessage(lastMessage?.content || "");
    return result.response.text() || "No response from AI";
  },

  async generate(prompt, maxTokens) {
    const model = geminiClient.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens, topP: 1 },
    });
    const result = await model.generateContent(prompt);
    return result.response.text()?.trim() || "";
  },
};

const ollamaProvider: AIProviderImpl = {
  async chat(messages, maxTokens) {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
        options: { temperature: 0.3, num_predict: maxTokens },
      }),
    });
    if (!response.ok) throw new Error(`Ollama API error: ${response.status}`);
    const data = await response.json();
    return data.message?.content || "No response from AI";
  },

  async generate(prompt, maxTokens) {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.3, num_predict: maxTokens },
      }),
    });
    if (!response.ok) throw new Error(`Ollama API error: ${response.status}`);
    const data = await response.json();
    return data.response || "";
  },
};

// ── Provider Registry ─────────────────────────────────────────────────────────
// Priority order: Groq → Gemini → Ollama
const PROVIDER_PRIORITY = ["groq", "gemini", "ollama"] as const;

const registry: Record<string, AIProviderImpl> = {
  groq: groqProvider,
  gemini: geminiProvider,
  ollama: ollamaProvider,
};

const AI_PROVIDER = (process.env.AI_PROVIDER || "groq").toLowerCase();

/** Returns provider order: requested first, then remaining in priority order as fallbacks */
function resolveOrder(primary: string): string[] {
  return [primary, ...PROVIDER_PRIORITY.filter(p => p !== primary)];
}

async function withFallback<T>(
  operation: (provider: AIProviderImpl, name: string) => Promise<T>,
  primary: string
): Promise<T> {
  const order = resolveOrder(primary);
  let lastError: unknown;

  for (const name of order) {
    const provider = registry[name];
    if (!provider) continue;
    try {
      const result = await operation(provider, name);
      if (name !== primary) console.warn(`AI: fell back to ${name} (primary: ${primary})`);
      return result;
    } catch (error: any) {
      console.error(`AI provider ${name} failed:`, error.message);
      lastError = error;
    }
  }

  throw lastError ?? new Error("All AI providers failed");
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function chat(
  messages: Message[],
  maxTokens = 350,
  providerOverride?: string
): Promise<string> {
  return withFallback(
    (p) => p.chat(messages, maxTokens),
    providerOverride || AI_PROVIDER
  );
}

export async function generate(
  prompt: string,
  maxTokens = 512,
  providerOverride?: string
): Promise<string> {
  return withFallback(
    (p) => p.generate(prompt, maxTokens),
    providerOverride || AI_PROVIDER
  );
}

export function getProvider(): string {
  return AI_PROVIDER;
}

export function compactContext(items: any[], mapper: (item: any) => string): string {
  return items.map(mapper).join("; ");
}
