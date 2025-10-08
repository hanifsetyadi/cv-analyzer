import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { parseDocumentPDFParser } from '../controllers/evaluateController.js';
import { evaluateCandidate } from '../controllers/llmController.js';
import { uploadNewDocument } from '../controllers/firestoreController.js'

const connection = new IORedis({ maxRetriesPerRequest: null });

const worker = new Worker('jobQueue', async job => {
    console.log(`Processing job ID: ${job.id}`);
    const uuid = job.data.id;
    const jobTitle = job.data.jobTitle;
    const items = await parseDocumentPDFParser(uuid);
    const result = await evaluateCandidate(items, jobTitle);
    await uploadNewDocument(uuid, job.id, result);
    return { result: result };
}, { connection });

worker.on('completed', (job, returnvalue) => {
    console.log(`Job ${job.id} completed with return value:`, returnvalue);
});

worker.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed with error:`, err);
});