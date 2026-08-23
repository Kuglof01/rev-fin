import { createClient } from '@supabase/supabase-js';

// These are public browser credentials. Supabase's publishable/anon key is designed
// to be used client-side; Row Level Security protects the database.
const fallbackUrl = 'https://injdymledbrolsvtphok.supabase.co';
const fallbackKey = 'sb_publishable_oDXZ73o2aA_ZYE6mVhiDCA_Cv_T5lAk';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  fallbackKey;

export const supabase = createClient(supabaseUrl, supabaseKey);
