const supabase = require('../supabaseClient');
const line = require('../line');
const { getLatestFollowup } = require('../supabaseMemoryManager');
const generateGPTMessage = require('./generateGPTMessage');
const generateFlexMessage = require('./flexBuilder');

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

// JST補正を入れた日数差計算
function getDaysSince(dateInput) {
  const baseDate = new Date(typeof dateInput === 'string' ? dateInput + 'Z' : dateInput);
  const now = new Date();

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
          text: '🌱 今日から本格的に「ととのうケア」始めましょう！'
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
          const followup = await getLatestFollowup(user.line_id);
          const msg = await generateGPTMessage(followup);
          await line.client.pushMessage(user.line_id, { type: 'text', text: msg });
          console.log('✅ GPTメッセージ送信完了');
        } else {
          const flex = generateFlexMessage();
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
