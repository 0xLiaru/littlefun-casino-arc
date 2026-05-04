import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://lrekxibbwyeklpcgpyet.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyZWt4aWJid3lla2xwY2dweWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4Nzc2MzAsImV4cCI6MjA5MzQ1MzYzMH0.wAnAkfN0n0Un-1kZ4skASTjfFdHWniMOUqNcXKMWo5I";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
