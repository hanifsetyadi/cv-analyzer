import express from 'express';
import { uploadNewFiles } from '../controllers/uploadController.js';
import { evaluateDocument, parseDocumentPDFParser } from '../controllers/evaluateController.js';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import multer from 'multer';
import { getJobStatus } from '../controllers/queueController.js';
import { addNewRubric } from '../controllers/llmController.js';

const upload = multer({ dest: 'uploads/' })
const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(helmet());
app.use(morgan("combined"));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.post(
  '/upload',
  upload.fields([
    { name: 'cv', maxCount: 1 },
    { name: 'projectReport', maxCount: 1 }
  ]),
  uploadNewFiles
);

app.post('/evaluate', (req, res) => {
  evaluateDocument(req, res);
});

app.get('/result/:id', (req, res) => {
  getJobStatus(req, res);
});

app.post('/addrubric', (req, res) => {
  addNewRubric(req, res)
})