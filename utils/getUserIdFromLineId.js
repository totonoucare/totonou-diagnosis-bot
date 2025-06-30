const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getUserIdFromLineId(lineIdRaw) {
  const lineId = lineIdRaw.replace(/\s/g, '').trim(); // ← 念のため全部クリーニング

  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("line_id", lineId)
    .single();

  if (error) {
    console.error("❌ user_id 取得エラー:", error);
    return null;
  }

  return data?.id || null;
}

module.exports = { getUserIdFromLineId };
