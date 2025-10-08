import 'dotenv/config';
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';
// import { StringOutputParser } from '@langchain/core/output_parsers';
import chromaCollectionPromise from './chromaService.js';
import { z } from "zod";

const ResponseFormatter = z.object({
  cv_match_rate: z.number().describe("Weighted average (0-1 decimal) based on four parameters — Technical Skills Match (backend, APIs, cloud, AI/LLM), Experience Level, Relevant Achievements, and Cultural/Collaboration Fit — reflecting how well the candidate's CV aligns with the Product Engineer (Backend) role."),
  cv_feedback: z.string().describe("Brief narrative (1-2 sentences) summarizing the candidate's CV strengths and weaknesses in relation to backend engineering, AI integration, and collaboration potential. Should mention gaps or highlights relevant to the job description."),
  project_score: z.number().describe("Average score (1-5 scale) derived from five parameters — Correctness (prompt chaining, LLM integration, RAG context), Code Quality & Structure, Resilience & Error Handling, Documentation & Explanation, and Creativity/Bonus — showing overall project delivery quality."),
  project_feedback: z.string().describe("Short feedback (1-2 sentences) summarizing project performance: how well prompt chaining, error handling, and documentation were executed, as well as code quality and innovation beyond base requirements."),
  overall_summary: z.string().describe("Concise summary (3-5 sentences) combining CV and project evaluations. Highlight technical strengths, growth areas, and overall recommendation for the Product Engineer (Backend) position — including readiness for AI-powered systems, prompt chaining, and RAG integration.")
});

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: GOOGLE_API_KEY,
  model: "gemini-embedding-001",
});

const llm = new ChatGoogleGenerativeAI({
  apiKey: GOOGLE_API_KEY,
  model: "gemini-2.5-flash",
  temperature: 0.3
  // maxOutputTokens: 800
});

// Condensed system documents - only essential info
const SYSTEM_DOCS = [
  {
    id: 'rubric_cv',
    content: `CV Eval (1-5, weighted avg x 0.2 = 0-1):
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
    content: `Product Engineer - Backend + AI/LLM focus
Must: Node/Python/Ruby, APIs, DB (SQL/Mongo), cloud (AWS/GCP/Azure)
AI: RAG, vector DBs, prompt design, LLM chaining, embeddings
Build: robust backends, AI features, handle async/long jobs, error handling
Culture: curious, collaborative, passionate about tech`,
    metadata: { type: 'job_desc' }
  }
];

async function syncSystemDocuments() {
  try {
    const collection = await chromaCollectionPromise;

    try {
      const existing = await collection.get({ ids: ['rubric_cv'] });
      if (existing.ids?.length > 0) {
        console.log('✓ System docs already synced');
        return collection;
      }
    } catch { }

    console.log('📝 Syncing system documents...');
    const embedResults = await Promise.all(
      SYSTEM_DOCS.map(d => embeddings.embedQuery(d.content))
    );

    await collection.add({
      ids: SYSTEM_DOCS.map(d => d.id),
      documents: SYSTEM_DOCS.map(d => d.content),
      metadatas: SYSTEM_DOCS.map(d => d.metadata),
      embeddings: embedResults
    });

    console.log('✓ System docs synced successfully');
    return collection;
  } catch (error) {
    console.error('❌ Sync error:', error.message);
    throw error;
  }
}

async function getContext(collection, k = 2) {
  try {
    const queryEmbed = await embeddings.embedQuery('eval backend AI engineer');
    const results = await collection.query({
      queryEmbeddings: [queryEmbed],
      nResults: k
    });
    const context = results.documents?.[0]?.join('\n') || '';
    console.log('✓ Context retrieved:', context.length, 'chars');
    return context;
  } catch (error) {
    console.error('❌ Retrieval error:', error.message);
    return '';
  }
}

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

export async function evaluateCandidate(item) {
  console.log('\n📊 Starting candidate evaluation...');
  
  if (!item?.cv?.text || !item?.project_report?.text) {
    const error = new Error("Missing cv.text or project_report.text");
    console.error('❌ Input validation failed:', error.message);
    throw error;
  }

  try {
    console.log('1️⃣ Syncing system documents...');
    const collection = await syncSystemDocuments();

    console.log('2️⃣ Retrieving context...');
    const context = await getContext(collection, 2);

    console.log('3️⃣ Preparing inputs...');
    // const cvText = item.cv.text.slice(0, 3000);
    // const projectText = item.project_report.text.slice(0, 4000);

    const cvText = item.cv.text;
    const projectText = item.project_report.text;
    
    console.log(`   CV: ${cvText.length} chars, Project: ${projectText.length} chars`);

    console.log('4️⃣ Creating prompt chain...');
    const prompt = createPrompt();
    
    console.log('5️⃣ Invoking LLM...');
    const chain = prompt.pipe(llm.withStructuredOutput(ResponseFormatter));

    const response = await chain.invoke({
      context,
      cv: cvText,
      project: projectText
    });

    console.log('\n✅ LLM Response received:');
    console.log('Raw response:', JSON.stringify(response, null, 2));


    // Validate response
    if (!response.cv_match_rate && response.cv_match_rate !== 0) {
      console.warn('⚠️ cv_match_rate is undefined');
    }
    if (!response.project_score && response.project_score !== 1) {
      console.warn('⚠️ project_score is undefined');
    }

    console.log('\n✅ Evaluation complete');
    return response;

  } catch (error) {
    console.error('\n❌ Evaluation failed:', error.message);
    console.error('Stack:', error.stack);
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