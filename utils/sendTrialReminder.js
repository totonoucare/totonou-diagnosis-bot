const supabase = require('../supabaseClient');
const line = require('../line');

console.log('🚀 トライアル用リマインダー実行開始');

// トライアル中のユーザー取得（trial_intro_done = true && subscribed = false）
async function getTrialUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, line_id, trial_intro_done, trial_intro_at, subscribed')
    .eq('trial_intro_done', true)
    .eq('subscribed', false);

  if (error) {
    console.error('❌ Supabaseからのトライアルユーザー取得失敗:', error);
    throw error;
  }
  return data;
}

// JST補正なし：保存済みの trial_intro_at はすでに JST なのでそのまま扱う
function getDaysSince(dateInput) {
  if (!dateInput) return null;
  const baseDate = new Date(dateInput);
  const now = new Date();

  const baseYMD = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const nowYMD = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffTime = nowYMD - baseYMD;
  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // デバッグログ
  console.log('🕒 now:', now.toISOString());
  console.log('🕒 baseDate:', baseDate.toISOString());
  console.log('📆 丸めた日付: nowYMD =', nowYMD.toISOString(), '| baseYMD =', baseYMD.toISOString());
  console.log('📆 日数カウント:', days);

  return days;
}

// メイン処理
async function sendTrialReminders() {
  try {
    const users = await getTrialUsers();
    console.log(`👥 トライアル中ユーザー数: ${users.length}`);

    for (const user of users) {
      console.log(`\n🔍 チェックユーザー: ${user.line_id}`);
      if (!user.trial_intro_at) {
        console.warn('⚠️ trial_intro_at 未設定スキップ');
        continue;
      }

      const days = getDaysSince(user.trial_intro_at);
      console.log(`📆 経過日数: ${days}`);

      // ✅ 各種日付条件に基づいて送信処理
      if (days === 9) {
        await line.client.pushMessage(user.line_id, {
          type: 'text',
          text:
            '📝 昨日でご利用から8日が経ちました！継続、すばらしいです✨\n\n' +
            'お身体の変化や、気づきはありましたか？☺️\n\n' +
            '「ととのうケアガイド📗」はいつでも見返せますので、引き続きじっくりご活用ください🌿\n\n' +
            'もしよろしければ、サービス品質向上のためのアンケートにご協力ください✨\n\n' +
            '▼ アンケートはこちら\nhttps://forms.gle/U94b2UEFGUaAEiJM7\n\n' +
            'ご回答はすべて匿名です。いただいたご意見は今後の品質改善に必ず反映させてまいります！\n\n' +
            '※アンケートは任意ですので、お時間あるときにご協力いただければ幸いです☺️',
        });
        console.log('✅ 9日目アンケート案内送信完了');
      } else if (days === 16) {
        const subscribeUrl = `https://totonoucare.com/subscribe/?line_id=${user.line_id}`;
        await line.client.pushMessage(user.line_id, {
          type: 'text',
          text:
            '🟢 トライアル期間が本日で終了します！ご利用ありがとうございました✨\n\n' +
            '引き続きケアサポートをご希望の方は、以下のリンクから本登録をお願いします👇\n\n' +
            `▶ 月額580円／980円のプランをご用意しています📱\n${subscribeUrl}`,
        });
        console.log('✅ 16日目本登録案内送信完了');
      } else {
        console.log(`⏭️ 該当日なし（days=${days}）`);
      }
    }
  } catch (mainErr) {
    console.error('💥 sendTrialReminders()全体で例外発生:', mainErr);
  }
}

sendTrialReminders().then(() => console.log('🎉 トライアル用リマインダー完了'));
