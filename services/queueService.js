import { Queue } from "bullmq";
import { QueueEvents } from "bullmq";

const logSource = "queueService - "

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
    console.log(`${logSource} Job ${jobId} is waiting to be processed`);
});

queueEvents.on('active', ({ jobId, prev }) => {             
    console.log(`${logSource} Job ${jobId} is now active; previous status was ${prev}`);
});

queueEvents.on('completed', ({ jobId, returnvalue }) => {
    console.log(`${logSource} Job ${jobId} has completed with return value: ${returnvalue}`);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
    console.log(`${logSource} Job ${jobId} has failed with reason: ${failedReason}`);
});

export { jobQueue };

