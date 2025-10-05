import { Queue } from "bullmq";
import dotenv from "dotenv";
import { QueueEvents } from "bullmq";

dotenv.config();



const jobQueue = new Queue('jobQueue', {
    connection: {
        host: process.env.REDIS_HOST || '',
        port: process.env.REDIS_PORT || 6379
    }
});

const queueEvents = new QueueEvents('jobQueue', {
    connection: {
        host: process.env.REDIS_HOST || '',
        port: process.env.REDIS_PORT || 6379
    }
});

queueEvents.on('waiting', ({ jobId }) => {
    console.log(`Job ${jobId} is waiting to be processed`);
});

queueEvents.on('active', ({ jobId, prev }) => {
    console.log(`Job ${jobId} is now active; previous status was ${prev}`);
});

queueEvents.on('completed', ({ jobId, returnvalue }) => {
    console.log(`Job ${jobId} has completed with return value: ${returnvalue}`);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
    console.log(`Job ${jobId} has failed with reason: ${failedReason}`);
});

export { jobQueue };

