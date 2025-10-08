import { GoogleGeminiEmbeddingFunction } from "@chroma-core/google-gemini";
import { CloudClient } from 'chromadb';
import dotenv from 'dotenv';

dotenv.config();

const embedder = new GoogleGeminiEmbeddingFunction({
  apiKey: process.env.GOOGLE_API_KEY,
});

const client = new CloudClient({
  apiKey: process.env.CHROMA_API_KEY,
  tenant: process.env.CHROMA_TENANT,
  database: process.env.CHROMA_DATABASE
});

const chromaCollectionPromise = client.getOrCreateCollection({
  name: "cv_analyze",
  embedding_function: embedder
});


export default chromaCollectionPromise;