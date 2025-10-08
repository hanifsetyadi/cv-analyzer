import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { parseDocumentPDFParser } from '../controllers/evaluateController.js';
import { evaluateCandidate } from '../services/llmService.js';


const connection = new IORedis({ maxRetriesPerRequest: null });

const worker = new Worker('jobQueue', async job => {
    console.log(`Processing job ID: ${job.id}, Title: ${job.data.jobTitle}`);
    const items = await parseDocumentPDFParser(job.data.id);
    const result = await evaluateCandidate(items);
    console.log(`Completed job ID: ${job.id}`);
    return { result: result };
}, { connection });

worker.on('completed', (job, returnvalue) => {
    console.log(`Job ${job.id} completed with return value:`, returnvalue);
});

worker.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed with error:`, err);
});