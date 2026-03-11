import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Use gemini-1.5-flash as it's more stable for the free tier quota
export const geminiModel = genAI?.getGenerativeModel({ model: "gemini-1.5-flash" });

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateContent(prompt: string, retries = 2, delay = 2000) {
    if (!geminiModel) {
        throw new Error("Gemini API key is not configured");
    }

    let lastError: any;
    for (let i = 0; i <= retries; i++) {
        try {
            const result = await geminiModel.generateContent(prompt);
            return result.response.text();
        } catch (error: any) {
            lastError = error;
            // Only retry on 429 (Rate Limit) or 5xx (Server Error)
            const isRateLimit = error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("quota");
            const isServerError = error?.status >= 500 || error?.message?.includes("500");

            if ((isRateLimit || isServerError) && i < retries) {
                // Exponential backoff: 2s, 4s...
                const waitTime = delay * Math.pow(2, i);
                console.warn(`Gemini API error (attempt ${i + 1}/${retries + 1}). Retrying in ${waitTime}ms...`, error.message);
                await sleep(waitTime);
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}
