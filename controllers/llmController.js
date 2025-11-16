import 'dotenv/config';
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';
import chromaCollectionPromise from '../services/chromaService.js';
import { z } from "zod";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: GOOGLE_API_KEY,
  model: "gemini-embedding-001",
});

const llm = new ChatGoogleGenerativeAI({
  apiKey: GOOGLE_API_KEY,
  model: "gemini-2.5-flash",
  temperature: 0.3
});

export async function addNewRubric(req, res) {
  const jobTitle = req.body.jobTitle
  const cvContent = req.body.cvContent
  const jobDescription = req.body.jobDescription
  const projectReportContent = req.body.projectReport

  const collection = await chromaCollectionPromise;

  const rubric = [
    {
      id: `rubric_cv_${jobTitle}`,
      content: cvContent,
      metadata: { type: 'rubric_cv' }
    },
    {
      id: `job_desc_${jobTitle}`,
      content: jobDescription,
      metadata: { type: 'job_desc' }
    },
    {
      id: `rubric_project_${jobTitle}`,
      content: projectReportContent,
      metadata: { type: 'rubric_project' }
    },
  ]

  const existing = await collection.get({ ids: [`rubric_cv_${jobTitle}`] });
  if (existing.ids?.length > 0) {
    console.log('System docs already synced');
    return res.status(400).json({
      error: "Rubric with this title is already exists"
    })
  }

  try {
    console.log('Syncing system documents...');
    const embedResults = await Promise.all(
      rubric.map(d => embeddings.embedQuery(d.content))
    );

    await collection.add({
      ids: rubric.map(d => d.id),
      documents: rubric.map(d => d.content),
      metadatas: rubric.map(d => d.metadata),
      embeddings: embedResults
    });

    return res.status(200).json({
      message: `Success to add rubric with job title: ${jobTitle}`
    })
  } catch (error) {
    console.log('Error syncing system documents:', error.message);
    return res.status(500).json(
      {
        "status": "error",
        "message": error.message
      }
    );
  }
}

async function getContext(collection, k = 2, jobTitle, maxRetries = 3, delayMs = 3000) {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log(`Retrieving context (attempt ${attempt + 1}/${maxRetries})...`);
      const queryEmbed = await embeddings.embedQuery(`eval ${jobTitle}`);

      const results = await collection.query({
        queryEmbeddings: [queryEmbed],
        nResults: k
      });

      const context = results.documents?.[0]?.join('\n') || '';
      console.log('Context retrieved:', context.length, 'chars');
      return context;

    } catch (error) {
      attempt++;
      console.error(`Retrieval error (attempt ${attempt}):`, error.message);

      // Jika masih ada kesempatan retry
      if (attempt < maxRetries) {
        console.log(`Retrying in ${delayMs}ms...`);
        await new Promise(res => setTimeout(res, delayMs));
      } else {
        console.error('Max retry attempts reached. Returning empty context.');
        return '';
      }
    }
  }
}

const createPrompt = () => {
  return PromptTemplate.fromTemplate(`Eval {jobTitle} candidate. Use rubrics strictly.

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

async function evaluateCandidate(item, jobTitle) {
  console.log('Starting candidate evaluation...');

  if (
    !item?.cv?.text 
    || !item?.project_report?.text
  ) {
    const error = new Error("Missing cv.text or project_report.text");
    console.error('Input validation failed:', error.message);
    throw error;
  }

  try {
    const collection = await chromaCollectionPromise;

    console.log('Retrieving context...');
    const context = await getContext(collection, 2, jobTitle);

    console.log('Preparing inputs...');

    const cvText = item.cv.text;
    const projectText = item.project_report.text;

    console.log(`CV: ${cvText.length} chars, Project: ${projectText.length} chars`);

    console.log('Creating prompt chain...');
    const prompt = createPrompt();

    console.log('Invoking LLM...');
    const chain = prompt.pipe(llm.withStructuredOutput(ResponseFormatter));
    console.log("prompt success");

    const response = await chain.invoke({
      context,
      cv: cvText,
      project: projectText,
      jobTitle: jobTitle
    });

    console.log('LLM Response received:');
    console.log('Raw response:', JSON.stringify(response, null, 2));

    if (!response.cv_match_rate && response.cv_match_rate !== 0) {
      console.warn('cv_match_rate is undefined');
    }
    if (!response.project_score && response.project_score !== 1) {
      console.warn('project_score is undefined');
    }

    console.log('Evaluation complete');
    return response;
  } catch (error) {
    console.error('Evaluation failed:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

// const ResponseFormatter = z.object({
//   cv_match_rate: z.number().describe("Weighted average (0-1 decimal)  Experience Level, Relevant Achievements, and Cultural/Collaboration Fit, reflecting how well the candidate's CV aligns with the role."),
//   cv_feedback: z.string().describe("Brief narrative (1-2 sentences) summarizing the candidate's CV strengths and weaknesses in relation to the job description and collaboration potential. Should mention gaps or highlights relevant to the job description."),
//   project_score: z.number().describe("Score (0-1 decimal) reflecting the quality and relevance of the candidate's project work in relation to the job description."),
//   project_feedback: z.string().describe("Concise feedback (1-2 sentences) on the candidate's project work, highlighting strengths and areas for improvement relevant to the job description."),
//   overall_summary: z.string().describe("Concise summary (3-5 sentences) combining CV. Highlight technical strengths, growth areas, and overall recommendation for the role")
// });

const ResponseFormatter = z.object({
  cv_match_rate: z.number().describe("Weighted average (0-1 decimal) based on four parameters — Technical Skills Match (backend, APIs, cloud, AI/LLM), Experience Level, Relevant Achievements, and Cultural/Collaboration Fit — reflecting how well the candidate's CV aligns with the Product Engineer (Backend) role."),
  cv_feedback: z.string().describe("Brief narrative (1-2 sentences) summarizing the candidate's CV strengths and weaknesses in relation to backend engineering, AI integration, and collaboration potential. Should mention gaps or highlights relevant to the job description."),
  project_score: z.number().describe("Average score (1-5 scale) derived from five parameters — Correctness (prompt chaining, LLM integration, RAG context), Code Quality & Structure, Resilience & Error Handling, Documentation & Explanation, and Creativity/Bonus — showing overall project delivery quality."),
  project_feedback: z.string().describe("Short feedback (1-2 sentences) summarizing project performance: how well prompt chaining, error handling, and documentation were executed, as well as code quality and innovation beyond base requirements."),
  overall_summary: z.string().describe("Concise summary (3-5 sentences) combining CV and project evaluations. Highlight technical strengths, growth areas, and overall recommendation for the Product Engineer (Backend) position — including readiness for AI-powered systems, prompt chaining, and RAG integration.")
});

export { evaluateCandidate }