import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL. Add it to your .env.local file."
  );
}

if (!key) {
  throw new Error(
    "Missing Supabase API key. Add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to your .env.local file."
  );
}

if (!url.startsWith("http://") && !url.startsWith("https://")) {
  throw new Error(
    `Invalid NEXT_PUBLIC_SUPABASE_URL: "${url}". It must start with http:// or https://`
  );
}

export const supabase = createClient(url, key);