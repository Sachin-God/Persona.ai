// MemoryManager.ts
// Updated to use Google Gemini (Generative AI) embeddings via LangChain's google-genai integration.
// Install:
//   npm install @langchain/google-genai @langchain/core @google/generative-ai
//
// Notes:
// - Provide GOOGLE_API_KEY (or other auth as required by your Google GenAI setup) in env.
// - Optionally set GOOGLE_EMBEDDING_MODEL (defaults to "gemini-embedding-001").
// References: LangChain google-genai docs, Gemini embeddings docs. 

import { Redis } from "@upstash/redis";
// Removed OpenAI-specific embeddings import and added Google GenAI embeddings
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";

export type personaKey = {
    personaName: string;
    modelName: string;
    userId: string;
};

export class MemoryManager {
    private static instance: MemoryManager | null = null;
    private history: Redis;
    private vectorDBClient: Pinecone | null = null;

    private constructor() {
        this.history = Redis.fromEnv();
        this.vectorDBClient = null;
    }

    // memory.ts (apply only the shown functions / integrate into your file)
// MemoryManager.init — replace your existing init() with this:
public async init() {
  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX;
  // New: optional controller host URL (useful for some Pinecone setups)
  // Example value: "https://controller.us-west1-gcp.pinecone.io"
  const controllerHostUrl = process.env.PINECONE_CONTROLLER_URL;

  if (!apiKey || !indexName) {
    console.warn(
      "Pinecone not configured. Please set PINECONE_API_KEY and PINECONE_INDEX. Vector DB disabled."
    );
    return;
  }

  try {
    // The modern Pinecone constructor accepts apiKey and controllerHostUrl (NOT `environment`).
    const client = new Pinecone({
      apiKey,
      ...(controllerHostUrl ? { controllerHostUrl } : {}),
    } as any);

    // verify access to the configured index (some SDKs provide describeIndexStats)
    const idx = client.Index(indexName);
    if (typeof idx.describeIndexStats === "function") {
      await idx.describeIndexStats();
    }

    this.vectorDBClient = client;
    console.log("Pinecone initialized successfully for index:", indexName);
  } catch (err: any) {
    const message = err?.message ?? String(err);
    if (message?.toLowerCase().includes("authorization") || message?.toLowerCase().includes("rejected")) {
      console.error("Pinecone authorization failed. Check PINECONE_API_KEY, PINECONE_INDEX and PINECONE_CONTROLLER_URL.", err);
    } else {
      console.error("Pinecone init failed:", err);
    }
    this.vectorDBClient = null;
  }
}

public async vectorSearch(
    recentChatHistory: string,
    personaFileName: string | undefined,
    topK = 3
) {
    if (!this.vectorDBClient) {
        console.warn("Pinecone client not initialized. Skipping vector search.");
        return null;
    }

    const indexName = process.env.PINECONE_INDEX;
    if (!indexName) {
        console.warn("PINECONE_INDEX env var is not set. Skipping vector search.");
        return null;
    }

    const googleApiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!googleApiKey) {
        console.warn("GOOGLE_API_KEY / GEMINI_API_KEY not set. Skipping Gemini embeddings-based vector search.");
        return null;
    }

    try {
        const pineconeIndex = this.vectorDBClient.Index(indexName);

        const embeddingModel = process.env.GOOGLE_EMBEDDING_MODEL || "models/text-embedding-004";

        const embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: googleApiKey,
            model: embeddingModel,
        } as any);

        const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
            pineconeIndex,
        });

        const storeAny = vectorStore as any;
        const filter = personaFileName ? { fileName: personaFileName } : undefined;

        const similarDocs = await storeAny.similaritySearch(recentChatHistory, topK, {
            filter,
        });

        return similarDocs;
    } catch (err: any) {
        const msg = err?.message ?? String(err);
        // Make Pinecone auth/permission issues explicit
        if (msg.toLowerCase().includes("authorization") || msg.toLowerCase().includes("rejected")) {
            console.error("Pinecone auth error during vectorSearch. Confirm key/index/region match your Pinecone project.", err);
        } else {
            console.error("WARNING: failed to get vector search results.", err);
        }
        // return null so the caller can continue without vector results
        return null;
    }
}


    public static async getInstance(): Promise<MemoryManager> {
        if (!MemoryManager.instance) {
            MemoryManager.instance = new MemoryManager();
            await MemoryManager.instance.init();
        }
        return MemoryManager.instance;
    }

    private generateRedispersonaKey(personaKey: personaKey): string {
        const safe = (s: string) => s.replace(/\s+/g, "_");
        return `${safe(personaKey.personaName)}-${safe(personaKey.modelName)}-${safe(
            personaKey.userId
        )}`;
    }

    public async writeToHistory(text: string, personaKey: personaKey) {
        if (!personaKey || typeof personaKey.userId === "undefined") {
            console.log("persona key set incorrectly");
            return "";
        }

        const key = this.generateRedispersonaKey(personaKey);

        try {
            const result = await this.history.zadd(key, {
                score: Date.now(),
                member: text,
            });
            return result;
        } catch (err) {
            console.error("Error writing to Redis history:", err);
            throw err;
        }
    }

    public async readLatestHistory(personaKey: personaKey): Promise<string> {
        if (!personaKey || typeof personaKey.userId === "undefined") {
            console.log("persona key set incorrectly");
            return "";
        }

        const key = this.generateRedispersonaKey(personaKey);

        try {
            const items = await this.history.zrange(key, -30, -1);
            const recentChats = items.join("\n");
            return recentChats;
        } catch (err) {
            console.error("Error reading Redis history:", err);
            return "";
        }
    }

    public async seedChatHistory(
        seedContent: string,
        delimiter = "\n",
        personaKey: personaKey
    ) {
        const key = this.generateRedispersonaKey(personaKey);

        try {
            const exists = await this.history.exists(key);
            if (exists) {
                console.log("User already has chat history");
                return;
            }

            const content = seedContent.split(delimiter).filter((l) => l.trim() !== "");
            let counter = 0;
            for (const line of content) {
                await this.history.zadd(key, { score: counter, member: line });
                counter += 1;
            }
        } catch (err) {
            console.error("Error seeding chat history:", err);
            throw err;
        }
    }
}
