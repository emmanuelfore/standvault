import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import buyerRoutes from './routes/buyers';
import popRoutes from './routes/pop';
import documentsRoutes from './routes/documents';
import notificationsRoutes from './routes/notifications';
import migrationRoutes from './routes/migration';
import uploadRoutes from './routes/upload';
import path from 'path';

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (req.method === 'POST') console.log('Body:', JSON.stringify(req.body, null, 2));
  next();
});
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/auth', authRoutes);
app.use('/projects', projectRoutes);
app.use('/buyers', buyerRoutes);
app.use('/pop', popRoutes);
app.use('/documents', documentsRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/migration', migrationRoutes);
app.use('/upload', uploadRoutes);

// Generic error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('--- ERROR START ---');
  console.error(err);
  if (err.stack) console.error(err.stack);
  console.error('--- ERROR END ---');
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    details: err.code || undefined
  });
});

export default app;
