// supabaseClient.js
const { createClient } = require('@supabase/supabase-js');

// ここはSupabaseのダッシュボードから取得してください
const supabaseUrl = 'https://YOUR_PROJECT_ID.supabase.co';
const supabaseKey = 'YOUR_SUPABASE_SERVICE_ROLE_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
