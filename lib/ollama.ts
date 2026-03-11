import { ChatOllama } from "@langchain/ollama";
import { StringOutputParser } from "@langchain/core/output_parsers";

// Initialize Ollama
// We use ChatOllama as it has better support for chat models and stop sequences
const ollama = new ChatOllama({
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  model: process.env.OLLAMA_MODEL || "tinyllama",
  temperature: 0.2,
});

/**
 * Compacts a list of items for smaller context windows
 */
export function compactContext(items: any[], mapper: (item: any) => string): string {
  return items.map(mapper).join("; ");
}

/**
 * Basic text cleaning and optimization for smaller models like tinyllama
 */
function optimizeInput(text: string): string {
  if (!text) return "";
  
  return text
    .trim()
    .replace(/\s+/g, " ") // Remove multiple spaces/newlines
    .replace(/[^\x00-\x7F]/g, "") // Remove non-ASCII characters
    .slice(0, 2000); // Back to a safer limit for very small models
}

/**
 * Generate content using Ollama and LangChain
 * Includes a simple retry mechanism and stop sequences
 */
export async function generateOllamaContent(prompt: string, retries = 1, stop?: string[]) {
  const optimizedPrompt = optimizeInput(prompt);
  console.log(`[Ollama] Generating content with stop sequence: ${stop ? stop.join(", ") : "none"}`);
  
  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      // ChatOllama expects an array of messages or a string
      // Let's use the invoke method which is more standard
      const response = await (ollama as any).invoke(optimizedPrompt, { stop });
      
      // ChatOllama returns an object with a .content property
      const content = response?.content;
      if (content === undefined) {
        throw new Error("Ollama returned an empty response content");
      }
      
      return typeof content === "string" ? content : JSON.stringify(content);
    } catch (error: any) {
      lastError = error;
      console.warn(`Ollama error (attempt ${i + 1}/${retries + 1}):`, error.message);
      
      if (i < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
    }
  }
  
  throw lastError || new Error("Ollama generation failed");
}

/**
 * Specifically for Chat - maintains a simple message-based format
 * Uses stop sequences to prevent the model from hallucinating the entire conversation
 */
export async function chatWithOllama(messages: { role: string; content: string }[]) {
  // Structure the chat history for a simple completion model
  const chatHistory = messages
    .map(m => `${m.role === "system" ? "System" : m.role === "user" ? "User" : "Assistant"}: ${optimizeInput(m.content)}`)
    .join("\n");
    
  const fullPrompt = `${chatHistory}\nAssistant:`;
  
  // Use "User:" as a stop sequence so the model stops before it starts talking for the user
  const response = await generateOllamaContent(fullPrompt, 1, ["User:", "System:", "Assistant:"]);
  
  // Clean up any trailing labels if the stop sequence didn't catch them
  // This split/trim handles cases where the model might generate these labels at the end
  return response
    .split("User:")[0]
    .split("Assistant:")[0]
    .split("System:")[0]
    .trim();
}
