// src/supabaseClient.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

let supabase = null;

/**
 * Call initSupabase({ url, key }) from main.js with your project's values.
 */
export function initSupabase({ url, key }) {
  if (!url || !key) throw new Error('Please provide Supabase URL and anon key');
  supabase = createClient(url, key, { realtime: { params: { eventsPerSecond: 10 } } });
  return supabase;
}

export function getSupabase() {
  if (!supabase) throw new Error('Supabase client not initialized. Call initSupabase first.');
  return supabase;
}
