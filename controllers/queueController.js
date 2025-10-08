import { jobQueue } from "../services/queueService.js";
import { getDocument, uploadErrorDocument } from "./firestoreController.js";

const logSource = "queueController - "

const addJob = async (id, jobTitle) => {
  const jobName = "analyzeJob";

  const data = {
    id,
    jobTitle,
    timestamp: new Date().toISOString(),
  };

  try {
    const job = await jobQueue.add(jobName, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 24 * 3600,
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 3600,
      },
    });

    console.log(`${logSource} Job added successfully`);
    console.log(`${logSource} - Job ID: ${job.id}`);
    console.log(`${logSource} - Job Title: ${jobTitle}`);
    console.log(`${logSource} - Status: waiting`);
    return job.id;
  } catch (error) {
    console.error(`${logSource} Error adding job:`, error);
    try {
      uploadErrorDocument(id, jobTitle, error);
    } catch (dbError) {
      console.error(`${logSource} Failed to log error to Firestore:`, dbError);
    }

    throw new Error(`Failed to add job: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

const getJobStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const job = await jobQueue.getJob(id);

    if (!job) {
      const doc = await getDocument(id)

      if (!doc.exists) {
        return res.status(404).json({
          error: 'Job not found',
          message: 'Job ID does not exist in queue or database'
        });
      }

      const jobData = doc.data();
      return res.status(200).json({
        id: doc.id,
        status: jobData.status,
        result: jobData.result,
        source: 'database',
        createdAt: jobData.createdAt,
        completedAt: jobData.completedAt
      });
    }

    const state = await job.getState();
    const jobData = job.returnvalue || {};

    const response = {
      id: job.id,
      status: state,
    };

    if (state === 'completed') {
      response.result = jobData;
      response.completedAt = job.finishedOn;
    }

    if (state === 'failed') {
      response.error = job.failedReason;
      response.failedAt = job.finishedOn;
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error getting job status:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export {
  addJob,
  getJobStatus
};