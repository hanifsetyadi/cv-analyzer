import { jobQueue } from "../services/queueService.js";

const logSource = "queueController - "

const addJob = async (id, jobTitle) => {
  const jobName = "analyzeJob";
  const data = {
    message: `Job for ${jobTitle} with ID ${id} added to the queue`,
    id,
    jobTitle,
    timestamp: new Date().toISOString(),
  };

  try {
    const job = await jobQueue.add(jobName, data);
    console.log(`${logSource} Job added with ID: ${job.id}`);

    const jobStatus = await job.getState();

    console.log(`Job ID ${job.id}:`);
    console.log(`- Name: ${job.name}`);
    console.log(`- Status: ${jobStatus}`);
    return job.id;
  } catch (error) {
    console.error(`${logSource} Error adding job: ${error.message}`);
  }
};

const printJob = async () => {
    const jobs = await jobQueue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed', 'queued']);
    console.log(`${logSource} Current Jobs in Queue:`);
    jobs.forEach(job => {
        console.log(`- Job ID: ${job.id}, Title: ${job.data.jobTitle}, Status: ${job.status}`);
    });
}

const getJobStatus = async (req,res) => {
  try {
    const { id } = req.params;
    const job = await jobQueue.getJob(id);
    const state = await job.getState()
    if (job) {
      res.status(200).json({ id: job.id, status: state });
    } else {
      res.status(404).json({ error: 'Job not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export { addJob, printJob, getJobStatus };