import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://bvocwvjfwademjorwzne.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseAnonKey || !supabaseServiceRoleKey) {
  console.warn('Supabase auth keys are missing. Auth flows will not work until SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are set.');
}

export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export const supabaseProjectUrl = supabaseUrl;
