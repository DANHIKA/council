/**
 * Unified AI Provider Interface
 * Switch between Groq, Gemini, and Ollama using AI_PROVIDER env var
 */

import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ── Configuration ─────────────────────────────────────────────────────────────
const AI_PROVIDER = (process.env.AI_PROVIDER || "groq").toLowerCase();

// Groq config
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-70b-versatile";

// Gemini config
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

// Ollama config
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "tinyllama";

// ── Types ─────────────────────────────────────────────────────────────────────
export type Message = { role: "system" | "user" | "assistant"; content: string };

// ── Provider Implementations ──────────────────────────────────────────────────

async function chatWithGroq(messages: Message[], maxTokens = 350): Promise<string> {
  const groqMessages = messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: groqMessages,
    temperature: 0.3,
    max_tokens: maxTokens,
    top_p: 1,
    stream: false,
  });

  return completion.choices[0]?.message?.content || "No response from AI";
}

async function generateWithGroq(prompt: string, maxTokens = 512): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: prompt }
    ],
    temperature: 0.3,
    max_tokens: maxTokens,
    top_p: 1,
    stream: false,
  });

  return completion.choices[0]?.message?.content?.trim() || "";
}

async function chatWithGemini(messages: Message[], maxTokens = 350): Promise<string> {
  const model = gemini.getGenerativeModel({ model: GEMINI_MODEL });

  // Convert to Gemini format (system prompt becomes first user message if needed)
  const systemMessage = messages.find(m => m.role === "system");
  const userMessages = messages.filter(m => m.role !== "system");

  let prompt = "";
  if (systemMessage) {
    prompt += `System: ${systemMessage.content}\n\n`;
  }
  prompt += userMessages.map(m => `${m.role === "assistant" ? "Model" : "User"}: ${m.content}`).join("\n");

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: maxTokens,
      topP: 1,
    },
  });

  return result.response.text() || "No response from AI";
}

async function generateWithGemini(prompt: string, maxTokens = 512): Promise<string> {
  const model = gemini.getGenerativeModel({ model: GEMINI_MODEL });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: maxTokens,
      topP: 1,
    },
  });

  return result.response.text()?.trim() || "";
}

async function chatWithOllama(messages: Message[], maxTokens = 350): Promise<string> {
  const ollamaMessages = messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: ollamaMessages,
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: maxTokens,
      }
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama API error: ${response.status}`);
  }

  const data = await response.json();
  return data.message?.content || "No response from AI";
}

async function generateWithOllama(prompt: string, maxTokens = 512): Promise<string> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: maxTokens,
      }
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama API error: ${response.status}`);
  }

  const data = await response.json();
  return data.response || "";
}

// ── Unified API ───────────────────────────────────────────────────────────────

/**
 * Chat with the configured AI provider
 * @param messages - Array of message objects with role and content
 * @param maxTokens - Maximum tokens to generate
 * @param providerOverride - Optional provider to use instead of env default
 */
export async function chat(messages: Message[], maxTokens = 350, providerOverride?: string): Promise<string> {
  const provider = providerOverride || AI_PROVIDER;
  
  try {
    switch (provider) {
      case "groq":
        return await chatWithGroq(messages, maxTokens);
      case "gemini":
        return await chatWithGemini(messages, maxTokens);
      case "ollama":
      default:
        return await chatWithOllama(messages, maxTokens);
    }
  } catch (error: any) {
    console.error(`AI provider (${provider}) error:`, error.message);
    throw error;
  }
}

/**
 * Generate content with the configured AI provider (non-chat tasks)
 * @param prompt - The prompt to generate content for
 * @param maxTokens - Maximum tokens to generate
 * @param providerOverride - Optional provider to use instead of env default
 */
export async function generate(prompt: string, maxTokens = 512, providerOverride?: string): Promise<string> {
  const provider = providerOverride || AI_PROVIDER;
  
  try {
    switch (provider) {
      case "groq":
        return await generateWithGroq(prompt, maxTokens);
      case "gemini":
        return await generateWithGemini(prompt, maxTokens);
      case "ollama":
      default:
        return await generateWithOllama(prompt, maxTokens);
    }
  } catch (error: any) {
    console.error(`AI provider (${provider}) error:`, error.message);
    throw error;
  }
}

/**
 * Get the current provider name
 */
export function getProvider(): string {
  return AI_PROVIDER;
}

/**
 * Compacts a list for context (utility function)
 */
export function compactContext(items: any[], mapper: (item: any) => string): string {
  return items.map(mapper).join("; ");
}
