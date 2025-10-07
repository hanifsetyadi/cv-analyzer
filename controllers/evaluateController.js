import { addJob } from "./queueController.js";
// import { addNewDocument } from "./chromaController.js";

const logSource = "evaluateController - "

const evaluateDocument = async (req, res) => {
    const { id, jobTitle } = req.body;

    if (!id || !jobTitle) {
        return res.status(400).json({ error: 'ID and Job Title are required' });
    }

    try {
        const jobID = await addJob(id, jobTitle);
        
        res.status(200).json(
            { "id" : jobID, 
              "status": "queued"
            }
        );
    } catch (error) {
        res.status(500).json(
            { "id" : id,
              "status": "error",
              "message": error.message
            }
        );
    }
};

export { evaluateDocument };