import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3010;

app.use(cors());
app.use(express.json());

// GET /
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'contributors-api',
    status: 'running'
  });
});

// GET /health
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'contributors-api',
    version: '1.0.0'
  });
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`[Contributors API] Server running on port ${PORT}`);
});
