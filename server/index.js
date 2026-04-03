import express from 'express';
import { createClient } from '@supabase/supabase-js';
import onboardingRouter from './routes/onboarding.js';
import membershipRouter from './routes/membership.js';
import workoutsRouter from './routes/workouts.js';
import progressRouter from './routes/progress.js';
import messagesRouter from './routes/messages.js';
import plansRouter from './routes/plans.js';
import accessRouter from './routes/access.js';
const app = express();
const PORT = process.env.PORT || 3001;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY must be defined');
  process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


app.use(express.json());

app.use('/api/onboarding', onboardingRouter);
app.use('/api/membership', membershipRouter);
app.use('/api/workouts', workoutsRouter);
app.use('/api/progress', progressRouter);
app.use('/api/messages', messagesRouter);
app.use('/api', plansRouter);
app.use('/api', accessRouter);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

export default app;
