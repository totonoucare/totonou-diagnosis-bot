const supabase = require('../supabaseClient');
const line = require('../line');
const { getLatestFollowup } = require('../supabaseMemoryManager');
const { buildReminderFlex } = require('./flexBuilder');
const generateGPTMessage = require('./generateGPTMessage');

console.log('🚀 リマインダー実行開始');

// サブスク中のユーザー取得
async function getSubscribedUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, line_id, subscribed, subscribed_at')
    .eq('subscribed', true);

  if (error) {
    console.error('❌ Supabaseからのユーザー取得失敗:', error);
    throw error;
  }
  return data;
}

// JST補正を入れた日数差計算（デバッグログ付き）
function getDaysSince(dateInput) {
  const baseDate = new Date(dateInput);
  const now = new Date();

  // デバッグログ追加
  console.log('🕒 now:', now.toISOString());
  console.log('🕒 baseDate:', baseDate.toISOString());
  console.log('📊 差分(ms):', now - baseDate);

  const jstBase = new Date(baseDate.getTime() + 9 * 60 * 60 * 1000);
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  const start = new Date(jstBase.getFullYear(), jstBase.getMonth(), jstBase.getDate());
  const end = new Date(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate());

  const diffTime = end - start;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// メイン処理
async function sendReminders() {
  try {
    const users = await getSubscribedUsers();
    console.log(`👥 サブスク中ユーザー数: ${users.length}`);

    for (const user of users) {
      console.log(`\n🔍 チェックユーザー: ${user.line_id}`);
      console.log(`🕒 subscribed_at: ${user.subscribed_at}`);

      if (!user.subscribed_at) {
        console.warn('⚠️ subscribed_at 未設定スキップ');
        continue;
      }

      const days = getDaysSince(user.subscribed_at);
      console.log(`📆 経過日数: ${days}`);

      if (days === 1) {
        console.log(`🟢 初回リマインド対象: ${user.line_id}`);
        await line.client.pushMessage(user.line_id, {
          type: 'text',
          text:
            '🌱 今日から本格的に『ととのうケア習慣』、始めていきましょうね！\n\n' +
            '最初は「習慣改善」や「ストレッチ」など、できそうなことから1つで大丈夫。\n' +
            '焦らず、心地よくいきましょう🧘‍♂️🍵'
        });
        console.log(`✅ 初回リマインド送信完了`);
        continue;
      }

      if (days === 0 || days % 4 !== 0) {
        console.log(`⏭️ リマインド対象外（days=${days}）`);
        continue;
      }

      const isEven = (days / 4) % 2 === 0;
      console.log(`🔄 ${days}日目: ${isEven ? 'GPT' : 'Flex'}送信対象`);

      try {
        if (isEven) {
          // 偶数回 → GPT生成コメント送信
          const msg = await generateGPTMessage(user.line_id);
          await line.client.pushMessage(user.line_id, { type: 'text', text: msg });
          console.log('✅ GPTメッセージ送信完了');
        } else {
          // 奇数回 → Flex（定期チェック診断ボタン）
          const flex = buildReminderFlex();
          await line.client.pushMessage(user.line_id, flex);
          console.log('✅ Flexメッセージ送信完了');
        }
      } catch (err) {
        console.error(`❌ メッセージ送信エラー:`, err);
      }
    }
  } catch (mainErr) {
    console.error('💥 sendReminders()全体で例外発生:', mainErr);
  }
}

sendReminders().then(() => console.log('🎉 リマインダー完了'));
