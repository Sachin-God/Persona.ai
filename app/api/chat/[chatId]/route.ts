// /app/api/chat/[chatId]/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { CallbackManager } from "@langchain/core/callbacks/manager";
import { Replicate } from "@langchain/community/llms/replicate";

import { MemoryManager } from "@/lib/memory";
import { rateLimit } from "@/lib/rate-limit";
import client from "@/lib/prismadb";

/**
 * Gemini fallback helper (unchanged logic, slightly cleaned).
 * Expects server API key in GEMINI_API_KEY | GOOGLE_API_KEY and optional GEMINI_MODEL.
 */
async function callGeminiAPI(prompt: string): Promise<string> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("No GEMINI_API_KEY / GOOGLE_API_KEY configured for Gemini fallback.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${text}`);
  }

  const json = await resp.json();

  const extractTextFromCandidate = (cand: any): string | null => {
    if (!cand) return null;
    const content = cand.content ?? cand;

    if (typeof content === "string") return content;

    if (Array.isArray(content)) {
      const partsText = content
        .map((item: any) => {
          if (!item) return "";
          if (typeof item === "string") return item;
          if (typeof item.text === "string") return item.text;
          if (Array.isArray(item.parts)) return item.parts.map((p: any) => (typeof p.text === "string" ? p.text : "")).join("");
          if (Array.isArray(item.content)) return item.content.map((c: any) => (typeof c === "string" ? c : c?.text ?? "")).join("");
          return "";
        })
        .filter(Boolean)
        .join("");
      if (partsText) return partsText;
    }

    if (typeof content === "object") {
      if (typeof content.text === "string") return content.text;
      if (Array.isArray(content.parts)) {
        const p = content.parts.map((pp: any) => (typeof pp.text === "string" ? pp.text : "")).join("");
        if (p) return p;
      }
      if (Array.isArray(content.items)) {
        return content.items.map((it: any) => (typeof it.text === "string" ? it.text : "")).join("");
      }
    }

    return null;
  };

  if (Array.isArray(json?.candidates) && json.candidates.length > 0) {
    for (const cand of json.candidates) {
      const t = extractTextFromCandidate(cand);
      if (t) return String(t);
    }
  }

  if (Array.isArray(json?.output) && json.output.length > 0) {
    for (const out of json.output) {
      const t = extractTextFromCandidate(out);
      if (t) return String(t);
    }
  }

  if (typeof json?.text === "string" && json.text.trim().length) return json.text;
  if (typeof json?.response === "string" && json.response.trim().length) return json.response;

  console.warn("callGeminiAPI: unrecognized Gemini response shape:", JSON.stringify(json, null, 2));
  return "";
}

/**
 * POST handler.
 * Note: `context.params` may be a Promise per Next's type; resolve it to get `chatId`.
 */
export async function POST(req: NextRequest, context: { params: { chatId: string } | Promise<{ chatId: string }> }) {
  try {
    // Resolve params (handles both plain object and Promise<{chatId}>)
    const paramsResolved = await Promise.resolve(context.params);
    const chatId = paramsResolved.chatId;

    // Read body
    const { prompt } = await req.json();

    // Auth: ensure we have a user
    const user = await currentUser();
    if (!user || !user.id || !user.firstName) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Rate limit
    const identifier = `${req.url}-${user.id}`;
    const { success } = await rateLimit(identifier);
    if (!success) {
      return new NextResponse("Rate Limit exceeded", { status: 429 });
    }

    // Persist user message to persona messages
    const persona = await client.persona.update({
      where: { id: chatId },
      data: {
        messages: {
          create: {
            content: prompt,
            role: "user",
            userId: user.id,
            id: crypto.randomUUID(),
          },
        },
      },
    });

    if (!persona) {
      return new NextResponse("Persona not found", { status: 404 });
    }

    // Memory key and manager
    const personaName = persona.id;
    const personaFileName = `${personaName}.txt`;
    const personaKey = { personaName, userId: user.id, modelName: "llama2-13b" };

    const memoryManager = await MemoryManager.getInstance();
    let records = await memoryManager.readLatestHistory(personaKey);

    if (!records || records.length === 0) {
      await memoryManager.seedChatHistory(persona.seed, "\n\n", personaKey);
      records = await memoryManager.readLatestHistory(personaKey);
    }

    // write user prompt to memory
    await memoryManager.writeToHistory(`User: ${prompt}\n`, personaKey);

    // Vector search for relevant history
    const recentChatHistory = await memoryManager.readLatestHistory(personaKey);
    const similarDocs = await memoryManager.vectorSearch(recentChatHistory, personaFileName);

    const relevantHistory = (similarDocs && similarDocs.length)
      ? similarDocs.map((d: any) => d.pageContent).join("\n")
      : "";

    // Prepare model (Replicate) with callback manager
    const handlers = {};
    const callbackManager = CallbackManager.fromHandlers(handlers);

    const model = new Replicate({
      model: "andreasjansson/llama-2-13b-embeddings:7115a4c65b86815e31412e53de1211c520164c190945a84c425b59dccbc47148",
      apiKey: process.env.REPLICATE_API,
      input: { max_length: 2048 },
      callbackManager,
    });
    model.verbose = true;

    const promptToModel = `
ONLY generate plain sentences without prefix of who is speaking. DO NOT use ${personaName}: prefix.

${persona.instruction}

Below are the relevant details about ${personaName}'s past and the conversation you are in.
${relevantHistory}

${recentChatHistory}
${personaName}:
`;

    // Try Replicate, fallback to Gemini on payment errors
    let responseText = "";
    try {
      const raw = await model.invoke(promptToModel);
      responseText = String(raw ?? "");
    } catch (err: any) {
      console.error("[MODEL_CALL_ERROR]", err);

      const isReplicatePaymentError =
        err?.response?.status === 402 ||
        String(err?.message ?? "").toLowerCase().includes("insufficient credit");

      if (isReplicatePaymentError) {
        console.warn("Replicate payment error — attempting Gemini fallback.");
        try {
          responseText = await callGeminiAPI(promptToModel);
          console.log("Gemini fallback succeeded.");
        } catch (gErr: any) {
          console.error("Gemini fallback failed:", gErr);
          throw err; // surface original replicate error
        }
      } else {
        throw err; // not a payment error; bubble up
      }
    }

    // Light cleanup and take first non-empty line
    const cleaned = responseText.replaceAll(",", "").trim();
    const firstLine = cleaned.split("\n").find((l) => l.trim().length > 0) ?? cleaned;
    const finalText = firstLine.trim();

    // Persist assistant reply
    if (finalText.length > 0) {
      await memoryManager.writeToHistory(finalText + "\n", personaKey);
      await client.persona.update({
        where: { id: chatId },
        data: {
          messages: {
            create: {
              content: finalText,
              role: "system",
              userId: user.id,
              id: crypto.randomUUID(),
            },
          },
        },
      });
    }

    return new NextResponse(finalText, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("[CHAT_POST] ", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
