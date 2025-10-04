import chromaCollectionPromise from "../config/chroma.js";
import fs from 'fs';
import path from 'path';

const addNewDocument = async (req, res) => {
  try {
    const cvFile = req.files['cv'];
    const projectFile = req.files['projectReport'];

    if (!cvFile || !projectFile) {
      return res.status(400).json({ error: 'Both CV and Project Report files are required' });
    }

    const uuid = crypto.randomUUID();

    const cvNewFileName = `cv-${uuid}${path.extname(cvFile[0].originalname) || '.pdf'}`;
    const projectNewFileName = `pr-${uuid}${path.extname(projectFile[0].originalname) || '.pdf'}`;

    const cvNewPath = path.join('files', cvNewFileName);
    const projectNewPath = path.join('files', projectNewFileName);

    fs.renameSync(cvFile[0].path, cvNewPath);
    fs.renameSync(projectFile[0].path, projectNewPath);

    res.json({ 
      message: 'Documents added successfully',
      cv: cvNewFileName,
      project_report: projectNewFileName
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export { addNewDocument };
