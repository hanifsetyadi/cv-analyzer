import 'dotenv/config';
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import chromaCollectionPromise from './chromaService.js';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: GOOGLE_API_KEY,
  modelName: "gemini-embedding-001",
});

const llm = new ChatGoogleGenerativeAI({
  apiKey: GOOGLE_API_KEY,
  modelName: "gemini-1.5-flash",
  temperature: 0.3,
  maxOutputTokens: 800, // Limit output to reduce costs
});

// Condensed system documents - only essential info
const SYSTEM_DOCS = [
  {
    id: 'rubric_cv',
    content: `CV Eval (1-5, weighted avg × 0.2 = 0-1):
Tech Skills 40%: backend/APIs/cloud/AI match (1=none, 5=perfect)
Experience 25%: yrs + complexity (1=<1yr trivial, 5=5+yr major)
Achievements 20%: impact/scale (1=none, 5=major measurable)
Culture 15%: collab/communication (1=none, 5=excellent)`,
    metadata: { type: 'rubric_cv' }
  },
  {
    id: 'rubric_project',
    content: `Project Eval (1-5, weighted avg):
Correctness 30%: prompt/LLM/RAG impl (1=missing, 5=perfect)
Code Quality 25%: structure/tests (1=poor, 5=excellent)
Resilience 20%: error handling/retries (1=none, 5=production-ready)
Docs 15%: README/setup (1=none, 5=excellent)
Creativity 10%: extras (1=none, 5=outstanding)`,
    metadata: { type: 'rubric_project' }
  },
  {
    id: 'job_desc',
    content: `Product Engineer @ Rakamin - Backend + AI/LLM focus
Must: Node/Python/Ruby, APIs, DB (SQL/Mongo), cloud (AWS/GCP/Azure)
AI: RAG, vector DBs, prompt design, LLM chaining, embeddings
Build: robust backends, AI features, handle async/long jobs, error handling
Culture: curious, collaborative, passionate about tech`,
    metadata: { type: 'job_desc' }
  }
];

// Sync system docs (only if needed)
async function syncSystemDocuments() {
  try {
    const collection = await chromaCollectionPromise;
    
    // Quick check if system docs exist
    try {
      const existing = await collection.get({ ids: ['rubric_cv'] });
      if (existing.ids?.length > 0) {
        return collection; // Already synced
      }
    } catch {}

    // Generate embeddings in parallel
    const embedResults = await Promise.all(
      SYSTEM_DOCS.map(d => embeddings.embedQuery(d.content))
    );

    await collection.add({
      ids: SYSTEM_DOCS.map(d => d.id),
      documents: SYSTEM_DOCS.map(d => d.content),
      metadatas: SYSTEM_DOCS.map(d => d.metadata),
      embeddings: embedResults
    });

    return collection;
  } catch (error) {
    console.error('Sync error:', error.message);
    throw error;
  }
}

// Efficient context retrieval
async function getContext(collection, k = 2) {
  try {
    const queryEmbed = await embeddings.embedQuery('eval backend AI engineer');
    const results = await collection.query({
      queryEmbeddings: [queryEmbed],
      nResults: k
    });
    return results.documents?.[0]?.join('\n') || '';
  } catch (error) {
    console.error('Retrieval error:', error.message);
    return '';
  }
}

// Compact prompt template
const createPrompt = () => {
  return PromptTemplate.fromTemplate(`Eval Product Engineer candidate. Use rubrics strictly.

RUBRICS:
{context}

CV:
{cv}

PROJECT:
{project}

Rate using rubrics. Output ONLY valid JSON:
{{
  "cv_match_rate": <0-1, 2 decimals>,
  "cv_feedback": "<key strengths/gaps, 50 words max>",
  "project_score": <1-5, 1 decimal>,
  "project_feedback": "<main findings, 50 words max>",
  "overall_summary": "<hire recommendation, 40 words max>"
}}

Be concise. No markdown.`);
};

// Parse JSON with fallback
function parseResult(text) {
  try {
    let cleaned = text.replace(/```\w*\s*/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) cleaned = match[0];
    
    const parsed = JSON.parse(cleaned);
    
    // Validate & clamp
    parsed.cv_match_rate = Math.max(0, Math.min(1, +(parsed.cv_match_rate || 0))).toFixed(2);
    parsed.project_score = Math.max(1, Math.min(5, +(parsed.project_score || 3))).toFixed(1);
    
    return parsed;
  } catch (error) {
    throw new Error(`Parse failed: ${error.message}`);
  }
}

// Main evaluation function
export async function evaluateCandidate(item) {
  if (!item?.cv?.text || !item?.project_report?.text) {
    throw new Error("Missing cv.text or project_report.text");
  }

  try {
    const collection = await syncSystemDocuments();
    
    // Get context (only 2 most relevant docs to save tokens)
    const context = await getContext(collection, 2);
    
    // Truncate inputs if too long (save tokens)
    const cvText = item.cv.text.slice(0, 3000);
    const projectText = item.project_report.text.slice(0, 4000);

    // Create and run chain
    const prompt = createPrompt();
    const chain = prompt.pipe(llm).pipe(new StringOutputParser());

    const response = await chain.invoke({
      context,
      cv: cvText,
      project: projectText
    });

    const result = parseResult(response);
    
    console.log('✅ Done:', {
      cv: `${(result.cv_match_rate * 100).toFixed(0)}%`,
      project: `${result.project_score}/5`
    });

    return result;
  } catch (error) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

// Health check
export async function healthCheck() {
  try {
    const collection = await chromaCollectionPromise;
    const count = await collection.count();
    return { status: 'ok', docs: count };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}