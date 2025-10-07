import { CloudClient } from 'chromadb';
import dotenv from 'dotenv';

dotenv.config();

const client = new CloudClient({
  apiKey: process.env.CHROMA_API_KEY,
  tenant: process.env.CHROMA_TENANT,
  database: process.env.CHROMA_DATABASE
});

const chromaCollectionPromise = client.getOrCreateCollection({
	name: "analyze-cv",
});

export default chromaCollectionPromise;