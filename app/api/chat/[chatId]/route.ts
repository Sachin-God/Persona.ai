// /api/chat/[chatId]/route.ts
import { auth, currentUser } from "@clerk/nextjs/server";
import { CallbackManager } from "@langchain/core/callbacks/manager";
import { Replicate } from "@langchain/community/llms/replicate";
import { NextResponse } from "next/server";

import { MemoryManager } from "@/lib/memory";
import { rateLimit } from "@/lib/rate-limit";
import client from "@/lib/prismadb";

/**
 * Helper to call Google Gemini (Generative Language) REST API as a fallback.
 * Uses x-goog-api-key header (server-side API key from AI Studio / Google Cloud).
 *
 * Env vars used:
 * - GEMINI_API_KEY or GOOGLE_API_KEY  (server API key)
 * - GEMINI_MODEL (optional, default: "gemini-2.5-flash")
 */
// Robust Gemini fallback helper
async function callGeminiAPI(prompt: string): Promise<string> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("No GEMINI_API_KEY / GOOGLE_API_KEY configured for Gemini fallback.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;

  const body = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    // optionally add temperature, candidateCount etc.
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${text}`);
  }

  const json = await resp.json();

  // Robust extraction helper
  const extractTextFromCandidate = (cand: any): string | null => {
    if (!cand) return null;

    // candidate.content may be a string, object, or array
    const content = cand.content ?? cand;
    // If content is string-like:
    if (typeof content === "string") return content;

    // If content is an array: try flattening text fields
    if (Array.isArray(content)) {
      const partsText = content
        .map((item: any) => {
          if (!item) return "";
          if (typeof item === "string") return item;
          // common shapes: { text: "..." } or { parts: [{ text: "..." }] }
          if (typeof item.text === "string") return item.text;
          if (Array.isArray(item.parts)) {
            return item.parts.map((p: any) => (typeof p.text === "string" ? p.text : "")).join("");
          }
          // nested content
          if (Array.isArray(item.content)) {
            return item.content.map((c: any) => (typeof c === "string" ? c : c?.text ?? "")).join("");
          }
          return "";
        })
        .filter(Boolean)
        .join("");
      if (partsText) return partsText;
    }

    // If content is object: try common keys
    if (typeof content === "object") {
      if (typeof content.text === "string") return content.text;
      if (Array.isArray(content.parts)) {
        const p = content.parts.map((pp: any) => (typeof pp.text === "string" ? pp.text : "")).join("");
        if (p) return p;
      }
      // some variants: content = { items: [...] }
      if (Array.isArray(content.items)) {
        return content.items.map((it: any) => (typeof it.text === "string" ? it.text : "")).join("");
      }
    }

    return null;
  };

  // Try multiple top-level shapes that Gemini might return
  // 1) json.candidates array
  if (Array.isArray(json?.candidates) && json.candidates.length > 0) {
    for (const cand of json.candidates) {
      const t = extractTextFromCandidate(cand);
      if (t) return String(t);
    }
  }

  // 2) json.output array
  if (Array.isArray(json?.output) && json.output.length > 0) {
    for (const out of json.output) {
      const t = extractTextFromCandidate(out);
      if (t) return String(t);
    }
  }

  // 3) direct text fields
  if (typeof json?.text === "string" && json.text.trim().length > 0) {
    return json.text;
  }
  if (typeof json?.response === "string" && json.response.trim().length > 0) {
    return json.response;
  }

  // Nothing matched — log full json for debugging and return empty string
  console.warn("callGeminiAPI: unrecognized Gemini response shape, logging full response for debugging:");
  console.warn(JSON.stringify(json, null, 2));
  return "";
}


export async function POST(
  req: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const { prompt } = await req.json();
    const user = await currentUser();

    if (!user || !user.firstName || !user.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const identifier = req.url + "-" + user.id;
    const { success } = await rateLimit(identifier);

    if (!success) {
      return new NextResponse("Rate Limit exceeded", { status: 429 });
    }

    const { chatId } = await params;
    console.log("chatId : ", chatId);

    // Persist the user message into the persona's message list
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

    const name = persona.id;
    const persona_file_name = name + ".txt";

    const personaKey = {
      personaName: name,
      userId: user.id,
      modelName: "llama2-13b",
    };

    const memoryManager = await MemoryManager.getInstance();
    let records = await memoryManager.readLatestHistory(personaKey);

    if (!records || records.length === 0) {
      await memoryManager.seedChatHistory(persona.seed, "\n\n", personaKey);
      records = await memoryManager.readLatestHistory(personaKey);
    }

    await memoryManager.writeToHistory("User: " + prompt + "\n", personaKey);

    // Query Pinecone (or your vector DB) for similar documents
    const recentChatHistory = await memoryManager.readLatestHistory(personaKey);
    const similarDocs = await memoryManager.vectorSearch(
      recentChatHistory,
      persona_file_name
    );

    let relevantHistory = "";
    if (similarDocs && similarDocs.length !== 0) {
      // @ts-ignore pageContent may exist depending on your vector doc shape
      relevantHistory = similarDocs.map((doc) => doc.pageContent).join("\n");
    }

    // Create LangChain/Replicate model
    const handlers = {};
    const callbackManager = CallbackManager.fromHandlers(handlers);

    const model = new Replicate({
      model: "andreasjansson/llama-2-13b-embeddings:7115a4c65b86815e31412e53de1211c520164c190945a84c425b59dccbc47148",
      apiKey: process.env.REPLICATE_API,
      input: {
        max_length: 2048,
      },
      callbackManager,
    });

    model.verbose = true;

    const promptToModel = `
ONLY generate plain sentences without prefix of who is speaking. DO NOT use ${name}: prefix.

${persona.instruction}

Below are the relevant details about ${name}'s past and the conversation you are in.
${relevantHistory}

${recentChatHistory}
${name}:
`;

    // Call the model (try Replicate first, fallback to Gemini)
    let respText = "";

    try {
      const respRaw = await model.invoke(promptToModel);
      respText = String(respRaw ?? "");
    } catch (err: any) {
      console.error("[MODEL_CALL_ERROR]", err);

      // detect Replicate payment error (402) or explicit insufficient credit text
      const isReplicatePaymentError =
        err?.response?.status === 402 ||
        String(err?.message ?? "").toLowerCase().includes("insufficient credit");

      if (isReplicatePaymentError) {
        console.warn("Replicate returned 402/Insufficient credit. Trying Gemini fallback if configured.");

        try {
          respText = await callGeminiAPI(promptToModel);
          console.log("Gemini fallback succeeded.");
        } catch (gemErr: any) {
          console.error("Gemini fallback failed:", gemErr);
          // Re-throw original replicate error so caller sees original cause (or you can throw gemErr)
          throw err;
        }
      } else {
        // Not a payment error — rethrow so outer catch returns 500
        throw err;
      }
    }

    // process respText as before
    const resp = String(respText ?? "");
    // light cleanup: remove leading/trailing blank lines and excessive commas if desired
    const cleaned = resp.replaceAll(",", "").trim();
    // take the first non-empty line as your response
    const firstLine = cleaned.split("\n").find((l) => l.trim().length > 0) ?? cleaned;

    const responseText = firstLine.trim();

    // persist the assistant/system reply to memory and DB
    if (responseText.length > 0) {
      await memoryManager.writeToHistory(responseText + "\n", personaKey);

      await client.persona.update({
        where: { id: chatId },
        data: {
          messages: {
            create: {
              content: responseText,
              role: "system",
              userId: user.id,
              id: crypto.randomUUID(),
            },
          },
        },
      });
    }

    // Return a normal HTTP response containing the generated text.
    return new NextResponse(responseText, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("[CHAT_POST] ", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
