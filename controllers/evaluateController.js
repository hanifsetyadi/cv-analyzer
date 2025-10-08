import { addJob } from "./queueController.js";
import { PDFParse } from "pdf-parse";
import { readFile } from 'node:fs/promises'

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

const parseDocumentPDFParser = async (fileName, res) => {
    try {
        if (!fileName) {
            return res.status(400).json({ error: 'fileName is required in the request body' });
        }

        const cv_filePath = `uploads/cv-${fileName}.pdf`;
        const pr_filePath = `uploads/pr-${fileName}.pdf`;

        const bufferCV = await readFile(cv_filePath);
        const bufferPR = await readFile(pr_filePath);

        const cvData = new PDFParse({data: bufferCV});
        const prData = new PDFParse({data: bufferPR});

        const cvResult = await cvData.getText();
        const prResult = await prData.getText();

        const data = {
            cv: cvResult,
            project_report: prResult
        };
        // console.log(`${logSource} Document parsed successfully with data: `, data);
        return data;

        // return res.status(200).json(data);
    } catch (error) {
        console.error(`${logSource} Error parsing document:`, error);
        // throw error;

        return res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' });
    }
};

export { evaluateDocument, parseDocumentPDFParser};