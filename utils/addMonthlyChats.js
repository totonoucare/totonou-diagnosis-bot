const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  try {
    const { data: users, error } = await supabase
      .from("users")
      .select("id, remaining_chats")
      .eq("plan_type", "standard");

    if (error) throw error;

    for (const user of users) {
      const newCount = Math.min((user.remaining_chats || 0) + 5, 30);

      const { error: updateError } = await supabase
        .from("users")
        .update({ remaining_chats: newCount })
        .eq("id", user.id);

      if (updateError) {
        console.error(`❌ ${user.id} 更新失敗:`, updateError);
      } else {
        console.log(`✅ ${user.id} 残り相談回数を ${newCount} に更新`);
      }
    }

    console.log("🎉 月初の相談回数加算処理が完了しました");
  } catch (err) {
    console.error("❌ 実行時エラー:", err);
    process.exit(1);
  }
})();
