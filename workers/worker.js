import { Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis({ maxRetriesPerRequest: null });

const worker = new Worker('jobQueue', async job => {
    console.log(`Processing job ID: ${job.id}, Title: ${job.data.jobTitle}`);
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log(`Completed job ID: ${job.id}`);
    return { result: 'success' };
}, { connection });

worker.on('completed', (job, returnvalue) => {
    console.log(`Job ${job.id} completed with return value:`, returnvalue);
});

worker.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed with error:`, err);
});