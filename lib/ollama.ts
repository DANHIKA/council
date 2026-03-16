import { getRelevantScenarios } from "@/lib/ai-scenarios";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "tinyllama";

/**
 * Compacts a list for context
 */
export function compactContext(items: any[], mapper: (item: any) => string): string {
  return items.map(mapper).join("; ");
}

/**
 * Call Ollama API directly
 */
async function callOllama(prompt: string, systemPrompt?: string): Promise<string> {
  const body: any = {
    model: OLLAMA_MODEL,
    prompt,
    stream: false,
    options: {
      temperature: 0.3,
      num_predict: 512,
    }
  };
  
  if (systemPrompt) {
    body.system = systemPrompt;
  }
  
  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama API error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  return data.response || "";
}

/**
 * Generate content using Ollama (for non-chat tasks)
 */
export async function generateOllamaContent(prompt: string, retries = 2): Promise<string> {
  let lastError: any;
  
  for (let i = 0; i <= retries; i++) {
    try {
      const content = await callOllama(prompt);
      if (content) return content;
    } catch (error: any) {
      lastError = error;
      console.warn(`Ollama error (attempt ${i + 1}/${retries + 1}):`, error.message);
      if (i < retries) await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  throw lastError || new Error("Ollama generation failed");
}

/**
 * Chat with Ollama using /api/chat endpoint
 */
export async function chatWithOllama(
  messages: { role: string; content: string }[],
  maxTokens = 350
): Promise<string> {
  try {
    // Convert messages to Ollama format
    const ollamaMessages = messages.map(msg => ({
      role: msg.role === "system" ? "system" : msg.role === "user" ? "user" : "assistant",
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
      console.error("Ollama chat API error:", response.status, error);
      throw new Error(`Ollama API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.message?.content || "No response from AI";
  } catch (error: any) {
    console.error("Ollama chat error:", error);
    throw error;
  }
}
