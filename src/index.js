import express from 'express';
import { uploadNewFiles } from '../controllers/uploadController.js';
import { evaluateDocument } from '../controllers/evaluateController.js';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import multer from 'multer';
import { printJob, getJobStatus } from '../controllers/queueController.js';

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

app.get('/print-queue', (req, res) => {
  try {
    printQueue();
    res.status(200).json({ message: 'Queue printed to console' });
  } catch (error) {
    res.status(500).json({ message: 'Error printing queue', error: error.message });
  }
});

app.get('/result/:id', (req, res) => {
  getJobStatus(req, res);
});
