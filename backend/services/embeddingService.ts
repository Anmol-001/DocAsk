let GoogleGenerativeAIEmbeddings: any;

export class EmbeddingService {
  private embeddings: any = null;
  private initialized: Promise<void>;

  constructor() {
    this.initialized = this.init();
  }

  private async init() {
    // We use Function('return import(...)') to force Node.js to use native ESM resolution.
    // This bypasses a known bug in @langchain/core where the CommonJS (.cjs) build is missing 
    // internal wrapper files, causing 'Cannot find module' crashes in CJS environments.
    const googleGenai = await Function('return import("@langchain/google-genai")')();
    GoogleGenerativeAIEmbeddings = googleGenai.GoogleGenerativeAIEmbeddings;

    if (process.env.GEMINI_API_KEY) {
      this.embeddings = new GoogleGenerativeAIEmbeddings({
        modelName: 'gemini-embedding-2',
        apiKey: process.env.GEMINI_API_KEY,
      });
    }
  }

  /**
   * Generates embeddings for an array of strings.
   * @param texts The array of text strings to embed.
   * @returns An array of embedding vectors (number[][]).
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    await this.initialized;
    if (!this.embeddings) {
      console.warn('GEMINI_API_KEY is missing. Skipping embedding generation.');
      return [];
    }

    try {
      console.log(`Generating embeddings for ${texts.length} chunks using gemini-embedding-2...`);
      // embedDocuments handles batching and retries natively under the hood in Langchain
      const vectors = await this.embeddings.embedDocuments(texts);
      console.log(`Successfully generated ${vectors.length} embeddings.`);
      return vectors;
    } catch (error) {
      console.error('Error generating embeddings from Gemini:', error);
      throw error;
    }
  }
}
