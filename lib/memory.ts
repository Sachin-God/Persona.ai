// MemoryManager.ts
// This file manages persistent and vector memory for a "companion" using:
//  - Upstash Redis for chronological chat history storage,
//  - OpenAI embeddings for converting text to vectors,
//  - Pinecone as the vector database, and
//  - LangChain's PineconeStore to bridge embeddings + Pinecone for similarity search.

//
// Imports
//
// - Redis.fromEnv() gives a Redis client configured from environment variables (Upstash).
// - OpenAIEmbeddings converts text into embedding vectors using the OpenAI API key.
// - Pinecone is the modern Pinecone client class; we hold an instance to call index operations.
// - PineconeStore is LangChain's helper to use a Pinecone index with LangChain embeddings/search utilities.
import { Redis } from "@upstash/redis";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";

export type CompanionKey = {
    companionName: string;
    modelName: string;
    userId: string;
};

export class MemoryManager {
    // Singleton instance for global reuse.
    private static instance: MemoryManager | null = null;

    // Redis client used as a sorted-set based timeline for chat history.
    private history: Redis;

    // Pinecone client instance (modern Pinecone type). Null until initialized.
    private vectorDBClient: Pinecone | null = null;

    // Private constructor: build the Redis client immediately and leave Pinecone uninitialized.
    private constructor() {
        // Create the Upstash Redis client using environment-derived config.
        this.history = Redis.fromEnv();

        // Pinecone is initialized later in init() so we can skip when no API key is present.
        this.vectorDBClient = null;
    }

    /**
     * Initialize Pinecone client
     *
     * - Reads the Pinecone API key from process.env.
     * - If not present, logs a warning and skips initializing the vector DB (safe fallback).
     * - When present, constructs the modern Pinecone client by passing the apiKey into the constructor.
     * - Saves the client on this.vectorDBClient for later index operations.
     */
    public async init() {
        // Read Pinecone API key from env.
        const apiKey = process.env.PINECONE_API_KEY;

        // If the API key is missing, warn and do not initialize Pinecone.
        if (!apiKey) {
            console.warn("PINECONE_API_KEY or PINECONE_ENVIRONMENT not set. Skipping Pinecone init.");
            return;
        }

        // Create the modern Pinecone client instance (ready to call index operations).
        const client = new Pinecone({
            apiKey,
        });

        // Store the client to be used by vectorSearch and other methods.
        this.vectorDBClient = client;
    }

    /**
     * Vector search / similarity lookup
     *
     * - recentChatHistory: the text to embed / search by similarity.
     * - companionFileName: optional metadata filter (assumed stored as `fileName` metadata in the index).
     * - topK: how many similar documents to return.
     *
     * Steps:
     * 1. Ensure Pinecone client and index name are available.
     * 2. Get a reference to the Pinecone index.
     * 3. Create an OpenAIEmbeddings instance for converting queries to vectors.
     * 4. Wrap the existing Pinecone index using LangChain's PineconeStore helper.
     * 5. Optionally apply a metadata filter (fileName) and call similaritySearch to retrieve topK matches.
     * 6. Return the found documents or null on error.
     */
    public async vectorSearch(
        recentChatHistory: string,
        companionFileName: string | undefined,
        topK = 3
    ) {
        // Ensure the Pinecone client has been initialized.
        if (!this.vectorDBClient) {
            console.warn("Pinecone client not initialized.");
            return null;
        }

        // Read the configured Pinecone index name from env.
        const indexName = process.env.PINECONE_INDEX;
        if (!indexName) {
            console.warn("PINECONE_INDEX env var is not set.");
            return null;
        }

        try {
            // Get a reference to the Pinecone index (the client's index accessor).
            const pineconeIndex = this.vectorDBClient.Index(indexName);

            // Build an embeddings object that will be used to convert the query text into a vector.
            const embeddings = new OpenAIEmbeddings({
                openAIApiKey: process.env.OPENAI_API_KEY,
            });

            // Create a LangChain PineconeStore that wraps the existing Pinecone index and the embeddings provider.
            // This makes similaritySearch (and other LangChain vector-store methods) available.
            const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
                pineconeIndex,
            });

            // Some LangChain versions have different TypeScript signatures; cast to any to access runtime methods.
            const storeAny = vectorStore as any;

            // Build an optional metadata filter object if a companion file name was provided.
            const filter = companionFileName ? { fileName: companionFileName } : undefined;

            // Execute similarity search: pass the query text, topK, and optional filter.
            // The exact parameter order/name may vary across LangChain versions; this is the conventional call.
            const similarDocs = await storeAny.similaritySearch(recentChatHistory, topK, {
                filter,
            });

            // Return the retrieved documents (could be empty array if no matches).
            return similarDocs;
        } catch (err) {
            // Log and return null on failures (network, permissions, mismatched client/index usage, etc).
            console.error("WARNING: failed to get vector search results.", err);
            return null;
        }
    }

    /**
     * getInstance (singleton factory)
     *
     * - Creates and initializes the singleton MemoryManager on first call.
     * - Ensures Pinecone init() is awaited so consumers have a ready instance.
     */
    public static async getInstance(): Promise<MemoryManager> {
        if (!MemoryManager.instance) {
            MemoryManager.instance = new MemoryManager();
            await MemoryManager.instance.init();
        }
        return MemoryManager.instance;
    }

    /**
     * generateRedisCompanionKey
     *
     * - Builds a stable Redis key for storing a companion's history by replacing whitespace with underscores
     *   and concatenating companionName, modelName and userId.
     */
    private generateRedisCompanionKey(companionKey: CompanionKey): string {
        const safe = (s: string) => s.replace(/\s+/g, "_");
        return `${safe(companionKey.companionName)}-${safe(companionKey.modelName)}-${safe(
            companionKey.userId
        )}`;
    }

    /**
     * writeToHistory
     *
     * - Writes a single text item to the companion's Redis sorted set.
     * - Uses the current timestamp (Date.now()) as the score so items are ordered by time.
     * - Returns the Redis command result or throws on error.
     */
    public async writeToHistory(text: string, companionKey: CompanionKey) {
        if (!companionKey || typeof companionKey.userId === "undefined") {
            console.log("Companion key set incorrectly");
            return "";
        }

        // Build the derived Redis key for this companion.
        const key = this.generateRedisCompanionKey(companionKey);

        try {
            // Use zadd to add the member with a numeric score (timestamp).
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

    /**
     * readLatestHistory
     *
     * - Reads the most recent 30 items from the companion's Redis sorted set.
     * - Joins them with newlines and returns the concatenated string (or empty string on error).
     */
    public async readLatestHistory(companionKey: CompanionKey): Promise<string> {
        if (!companionKey || typeof companionKey.userId === "undefined") {
            console.log("Companion key set incorrectly");
            return "";
        }

        const key = this.generateRedisCompanionKey(companionKey);

        try {
            // zrange -30..-1 returns up to the last 30 members in chronological order.
            const items = await this.history.zrange(key, -30, -1);
            const recentChats = items.join("\n");
            return recentChats;
        } catch (err) {
            console.error("Error reading Redis history:", err);
            return "";
        }
    }

    /**
     * seedChatHistory
     *
     * - Seeds a new companion history from a block of seedContent separated by `delimiter`.
     * - Skips seeding if the key already exists.
     * - Each seed line is written with an incrementing numeric score to preserve order.
     */
    public async seedChatHistory(
        seedContent: string,
        delimiter = "\n",
        companionKey: CompanionKey
    ) {
        const key = this.generateRedisCompanionKey(companionKey);

        try {
            // If any history already exists for this key, do not overwrite.
            const exists = await this.history.exists(key);
            if (exists) {
                console.log("User already has chat history");
                return;
            }

            // Split the seed content into non-empty lines and store each line as a sorted-set member.
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
