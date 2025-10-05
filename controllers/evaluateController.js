import { addQueue } from "./queueController.js";

const evaluateDocument = async (req, res) => {
    const { id, jobTitle } = req.body;

    if (!id || !jobTitle) {
        return res.status(400).json({ error: 'ID and Job Title are required' });
    }

    try {
        await addQueue(id, jobTitle);
        res.status(200).json(
            { "id" : id, 
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