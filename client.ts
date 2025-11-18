import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

if (!SUPABASE_URL) {
  // eslint-disable-next-line no-console
  console.warn('VITE_SUPABASE_URL is not set');
}
if (!SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn('VITE_SUPABASE_ANON_KEY is not set');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// debug helper - DO NOT leave in production for long
export const _supabase_debug = {
  url: SUPABASE_URL,
  anon_present: !!SUPABASE_ANON_KEY
};
