import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

/** Streams a vision request through Lovable AI and returns parsed JSON. */
export async function askVisionJson<T>(prompt: string, images: Uint8Array[]): Promise<T> {
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) throw new Error("AI is not configured");
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  const result = streamText({
    model: provider.responses(MODEL),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt + "\nRespond with ONLY a json object, no markdown." },
          ...images.map((b) => ({ type: "file" as const, data: b, mediaType: "image/jpeg" })),
        ],
      },
    ],
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  let text: string;
  try {
    text = await result.text;
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 402) throw new Error("AI credits have run out. Please top up to continue.");
    if (status === 429) throw new Error("AI is busy right now. Please try again in a minute.");
    throw new Error("AI analysis failed. Please try again.");
  }
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI returned an unreadable answer. Please try again.");
  return JSON.parse(match[0]) as T;
}
