import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const uploadNewFiles = async (req, res) => {
  try {
    const cvFile = req.files['cv'];
    const projectFile = req.files['projectReport'];

    if (!cvFile || !projectFile) {
      if (cvFile) fs.unlinkSync(cvFile[0].path);
      if (projectFile) fs.unlinkSync(projectFile[0].path);
      
      return res.status(400).json({ 
        error: 'Both CV and Project Report files are required' 
      });
    }

    const cvMimeType = cvFile[0].mimetype;
    const projectMimeType = projectFile[0].mimetype;
    
    if (cvMimeType !== 'application/pdf') {
      fs.unlinkSync(cvFile[0].path);
      fs.unlinkSync(projectFile[0].path);
      
      return res.status(400).json({ 
        error: 'CV file must be a PDF',
        receivedType: cvMimeType
      });
    }

    if (projectMimeType !== 'application/pdf') {
      fs.unlinkSync(cvFile[0].path);
      fs.unlinkSync(projectFile[0].path);
      
      return res.status(400).json({ 
        error: 'Project Report file must be a PDF',
        receivedType: projectMimeType
      });
    }

    const maxSize = 10 * 1024 * 1024;
    
    if (cvFile[0].size > maxSize) {
      fs.unlinkSync(cvFile[0].path);
      fs.unlinkSync(projectFile[0].path);
      
      return res.status(400).json({ 
        error: 'CV file size exceeds 10MB limit',
        fileSize: `${(cvFile[0].size / 1024 / 1024).toFixed(2)}MB`
      });
    }

    if (projectFile[0].size > maxSize) {
      fs.unlinkSync(cvFile[0].path);
      fs.unlinkSync(projectFile[0].path);
      
      return res.status(400).json({ 
        error: 'Project Report file size exceeds 10MB limit',
        fileSize: `${(projectFile[0].size / 1024 / 1024).toFixed(2)}MB`
      });
    }

    const uuid = crypto.randomUUID();
    const cvNewFileName = `cv-${uuid}.pdf`;
    const projectNewFileName = `pr-${uuid}.pdf`;

    const cvNewPath = path.join('uploads', cvNewFileName);
    const projectNewPath = path.join('uploads', projectNewFileName);

    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads', { recursive: true });
    }

    try {
      fs.renameSync(cvFile[0].path, cvNewPath);
      fs.renameSync(projectFile[0].path, projectNewPath);
    } catch (renameError) {
      if (fs.existsSync(cvNewPath)) fs.unlinkSync(cvNewPath);
      if (fs.existsSync(projectNewPath)) fs.unlinkSync(projectNewPath);
      if (fs.existsSync(cvFile[0].path)) fs.unlinkSync(cvFile[0].path);
      if (fs.existsSync(projectFile[0].path)) fs.unlinkSync(projectFile[0].path);
      
      throw renameError;
    }

    res.status(200).json({ 
      message: 'Files uploaded successfully',
      data: {
        cv: cvNewFileName,
        projectReport: projectNewFileName,
        uuid: uuid
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export { uploadNewFiles };