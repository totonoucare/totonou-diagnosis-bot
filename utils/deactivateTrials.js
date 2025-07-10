const supabase = require('../supabaseClient');

console.log('🚫 トライアル強制終了スクリプト開始');

// JST日数差を計算
function getDaysSince(dateInput) {
  if (!dateInput) return null;
  const baseDate = new Date(dateInput);
  const now = new Date();

  const jstBase = new Date(baseDate.getTime() + 9 * 60 * 60 * 1000);
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  const start = new Date(jstBase.getFullYear(), jstBase.getMonth(), jstBase.getDate());
  const end = new Date(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate());

  const diffTime = end - start;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// JST現在時刻（ISO文字列）を取得
function getJSTISOStringNow() {
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jstNow.toISOString();
}

async function deactivateExpiredTrials() {
  const { data, error } = await supabase
    .from('users')
    .select('id, line_id, trial_intro_done, trial_intro_at')
    .eq('trial_intro_done', true)
    .eq('subscribed', false);

  if (error) {
    console.error('❌ ユーザー取得エラー:', error);
    return;
  }

  const expiredUsers = data.filter((user) => {
    const days = getDaysSince(user.trial_intro_at);
    return days !== null && days >= 17;
  });

  console.log(`🔍 強制終了対象ユーザー数: ${expiredUsers.length}`);

  for (const user of expiredUsers) {
    const { error: updateError } = await supabase
      .from('users')
      .update({
        trial_intro_done: false,
        trial_ended_at: getJSTISOStringNow(), // ← JSTで記録
      })
      .eq('id', user.id);

    if (updateError) {
      console.error(`❌ ユーザーID ${user.id} の更新失敗:`, updateError);
    } else {
      console.log(`✅ ユーザーID ${user.id} を trial_intro_done: false に更新（終了日時も記録）`);
    }
  }
}

deactivateExpiredTrials().then(() => {
  console.log('🎉 トライアル強制終了処理完了');
});
