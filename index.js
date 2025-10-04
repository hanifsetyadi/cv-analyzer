import express from 'express';
import { addNewDocument } from './controllers/controller.js';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import multer from 'multer';

const upload = multer({ dest: 'files/' })
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
  addNewDocument
);

app.post('/evaluate', (req, res) => {
  res.send('Hello World!');
});
