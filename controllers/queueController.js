import { jobQueue } from "../services/queueService.js";

const addQueue = async (id, jobTitle) => {
  const jobName = "analyzeJob";
  const data = {
    message: `Job for ${jobTitle} with ID ${id} added to the queue`,
    id,
    jobTitle,
    timestamp: new Date().toISOString(),
  };

  try {
    const job = await jobQueue.add(jobName, data);
    console.log(`Job added with ID: ${job.id}`);

    const jobStatus = await job.getState();

    console.log(`Job ID ${job.id}:`);
    console.log(`- Name: ${job.name}`);
    console.log(`- Status: ${jobStatus}`);
  } catch (error) {
    console.error(` Error adding job: ${error.message}`);
  }
};

const printQueue = async () => {
    const jobs = await jobQueue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed', 'queued']);
    console.log("Current Jobs in Queue:");
    jobs.forEach(job => {
        console.log(`- Job ID: ${job.id}, Title: ${job.data.jobTitle}, Status: ${job.status}`);
    });
}

export { addQueue, printQueue };