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

// JST補正を入れた日数差計算
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
      if (days === 7) {
        await line.client.pushMessage(user.line_id, {
          type: 'text',
          text:
            '📝 無料おためしは明日まで！\n\n' +
            'もしまだじっくり見れてない方は、ぜひ「ととのうケアガイド📗」を一度ご覧ください。\n' +
            '簡単なアンケートに答えていただくと、さらに【7日間の延長】がもらえます😊\n\n' +
            '→ アンケートはこちら\nhttps://〜〜（あとでURL挿入）',
        });
        console.log('✅ 7日目アンケート案内送信完了');
      } else if (days === 15) {
        await line.client.pushMessage(user.line_id, {
          type: 'text',
          text:
            '🟢 トライアル期間があと1日で終了します！\n\n' +
            '引き続きケアサポートをご希望の方は、以下から本登録をお願いします。\n\n' +
            '▶ 月額580円／980円のプランをご用意しています📱\nメニュー内の『ご案内リンク集』からご覧ください',
        });
        console.log('✅ 15日目本登録案内送信完了');
      } else {
        console.log(`⏭️ 該当日なし（days=${days}）`);
      }
    }
  } catch (mainErr) {
    console.error('💥 sendTrialReminders()全体で例外発生:', mainErr);
  }
}

sendTrialReminders().then(() => console.log('🎉 トライアル用リマインダー完了'));
