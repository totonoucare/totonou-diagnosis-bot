// supabaseClient.js
const { createClient } = require('@supabase/supabase-js');

// 環境変数から URL と Service Role Key を取得
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = supabase;
