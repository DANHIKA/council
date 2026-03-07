import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export const geminiModel = genAI?.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function generateContent(prompt: string) {
    if (!geminiModel) {
        throw new Error("Gemini API key is not configured");
    }
    const result = await geminiModel.generateContent(prompt);
    return result.response.text();
}
