const supabase = require('../supabaseClient');
const line = require('../line');
const { getLatestFollowup } = require('../supabaseMemoryManager');
const generateGPTMessage = require('./generateGPTMessage');
const generateFlexMessage = require('./flexBuilder');

// サブスク中のユーザー取得
async function getSubscribedUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, line_id, subscribed, subscribed_at')
    .eq('subscribed', true);

  if (error) throw error;
  return data;
}

// JST補正を入れた日数差計算
function getDaysSince(dateString) {
  const baseDate = new Date(dateString);
  const now = new Date();

  // JST補正（+9時間）
  const jstBase = new Date(baseDate.getTime() + 9 * 60 * 60 * 1000);
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  const start = new Date(jstBase.getFullYear(), jstBase.getMonth(), jstBase.getDate());
  const end = new Date(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate());

  const diffTime = end - start;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// メイン処理
async function sendReminders() {
  const users = await getSubscribedUsers();
  console.log(`👥 リマインド対象ユーザー数: ${users.length}`);

  for (const user of users) {
    console.log(`\n🔍 チェック中ユーザー: ${user.line_id}`);
    console.log(`🕒 subscribed_at: ${user.subscribed_at}`);

    const refDate = user.subscribed_at;
    if (!refDate) {
      console.warn(`⚠️ subscribed_at が未設定のためスキップ: ${user.line_id}`);
      continue;
    }

    const days = getDaysSince(refDate);
    console.log(`📆 経過日数: ${days}日`);

    // ✅ 1日後の初回リマインド
    if (days === 1) {
      console.log(`🟢 初回リマインド対象`);
      try {
        await line.client.pushMessage(user.line_id, {
          type: 'text',
          text:
            '今日から本格的に『ととのうケア習慣』、始めていきましょうね🌱\n\n' +
            '最初は「習慣改善」や「ストレッチ」など、できそうなことから1つで大丈夫。\n' +
            '焦らず、心地よくいきましょう🧘‍♂️🍵'
        });
        console.log(`✅ 初回リマインド送信成功`);
      } catch (err) {
        console.error(`❌ 初回リマインド送信失敗:`, err);
      }
      continue;
    }

    // ⛔ スキップ条件
    if (days === 0 || days % 4 !== 0) {
      console.log(`⏭️ スキップ（days=${days}）`);
      continue;
    }

    const isEvenCycle = (days / 4) % 2 === 0;
    console.log(`🔄 ${days}日目 → ${(isEvenCycle ? 'GPT' : 'Flex')}送信対象`);

    try {
      if (isEvenCycle) {
        const followup = await getLatestFollowup(user.line_id);
        const gptMessage = await generateGPTMessage(followup);
        await line.client.pushMessage(user.line_id, { type: 'text', text: gptMessage });
        console.log(`✅ GPTメッセージ送信成功`);
      } else {
        const flex = generateFlexMessage();
        await line.client.pushMessage(user.line_id, flex);
        console.log(`✅ Flexカード送信成功`);
      }
    } catch (err) {
      console.error(`❌ メッセージ送信失敗:`, err);
    }
  }
}

module.exports = sendReminders;
