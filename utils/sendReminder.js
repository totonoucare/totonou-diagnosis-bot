const supabase = require('../supabaseClient');
const line = require('../line');
const { getLatestFollowup } = require('../supabaseMemoryManager');
const { buildReminderFlex } = require('./flexBuilder');
const { generateGPTMessage } = require('./generateGPTMessage');

console.log('🚀 リマインダー実行開始');

// ✅ サブスク中または体験中のユーザー取得
async function getActiveUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, line_id, subscribed, subscribed_at, trial_intro_done, trial_intro_at')
    .or('subscribed.eq.true,trial_intro_done.eq.true');

  if (error) {
    console.error('❌ Supabaseからのユーザー取得失敗:', error);
    throw error;
  }
  return data;
}

// ✅ JST補正を入れた「日付またぎで1日カウントする」日数カウント
function getDaysSince(dateInput) {
  const baseDate = new Date(dateInput);
  const now = new Date();

  // JST補正
  const jstBase = new Date(baseDate.getTime() + 9 * 60 * 60 * 1000);
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  const baseYMD = new Date(jstBase.getFullYear(), jstBase.getMonth(), jstBase.getDate());
  const nowYMD = new Date(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate());

  const diffTime = nowYMD - baseYMD;
  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // デバッグログ
  console.log('🕒 now:', now.toISOString());
  console.log('🕒 baseDate:', baseDate.toISOString());
  console.log('📆 日数カウント:', days);

  return days;
}

// ✅ メイン処理
async function sendReminders() {
  try {
    const users = await getActiveUsers();
    console.log(`👥 リマインド対象ユーザー数: ${users.length}`);

    for (const user of users) {
      console.log(`\n🔍 チェックユーザー: ${user.line_id}`);
      const baseDate = user.subscribed_at || user.trial_intro_at;

      if (!baseDate) {
        console.warn('⚠️ 開始日時未設定スキップ');
        continue;
      }

      const days = getDaysSince(baseDate);
      console.log(`📆 経過日数: ${days}`);

      // ✅ 初回（1日後）リマインド
      if (days === 1) {
        console.log(`🟢 初回リマインド対象: ${user.line_id}`);
        await line.client.pushMessage(user.line_id, {
          type: 'text',
          text:
            '🌱 今日から本格的に『ととのうケア習慣』、始めていきましょうね！\n\n' +
            '最初は「習慣改善」や「ストレッチ」など、できそうなことから焦らず、心地よく始めていきましょう🧘‍♂️🍵☺\n' +
            '『ととのうケアガイド📗』はメニューのボタンで繰り返し見返せるので何度でも利用してくださいね☺️'
        });
        console.log(`✅ 初回リマインド送信完了`);
        continue;
      }

      // ✅ 4日ごと以外はスキップ
      if (days === 0 || days % 4 !== 0) {
        console.log(`⏭️ リマインド対象外（days=${days})`);
        continue;
      }

      // ✅ 4日ごとの偶数回（8日、16日…）→ GPTメッセージ
      // ✅ 4日ごとの奇数回（4日、12日…）→ Flexメッセージ
      const reminderCount = days / 4;
      const isEven = reminderCount % 2 === 0;
      console.log(`🔄 ${days}日目: ${isEven ? 'GPT' : 'Flex'}送信対象`);

      try {
        if (isEven) {
          const msg = await generateGPTMessage(user.line_id);
          await line.client.pushMessage(user.line_id, { type: 'text', text: msg });
          console.log('✅ GPTメッセージ送信完了');
        } else {
          const flex = buildReminderFlex();
          await line.client.pushMessage(user.line_id, flex);
          console.log('✅ Flexメッセージ送信完了');
        }
      } catch (err) {
        console.error('❌ メッセージ送信エラー:', err);
      }
    }
  } catch (mainErr) {
    console.error('💥 sendReminders()全体で例外発生:', mainErr);
  }
}

sendReminders().then(() => console.log('🎉 リマインダー完了'));
