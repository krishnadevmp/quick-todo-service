import express from 'express';
import cors from 'cors';
import { env } from './lib/env';
import apiRoutes from './routes';
import { errorHandler } from './middleware/errorHandler';

export const app = express();

app.use(
  cors({
    origin: env.corsOrigins,
    credentials: false, // Bearer-token auth, not cookies — see docs/DATABASE_DESIGN.md
  })
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api', apiRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);
