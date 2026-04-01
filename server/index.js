import express from 'express';
import { createClient } from '@supabase/supabase-js';
import onboardingRouter from './routes/onboarding.js';

const app = express();
const PORT = process.env.PORT || 3001;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY must be defined');
  process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

import onboardingRouter from './routes/onboarding.js';
import membershipRouter from './routes/membership.js';

app.use(express.json());

app.use('/api/onboarding', onboardingRouter);
app.use('/api/membership', membershipRouter);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

export default app;
