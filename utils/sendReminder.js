const supabase = require('../supabaseClient');
const line = require('../line');
const { getLatestFollowup } = require('../supabaseMemoryManager');
const generateGPTMessage = require('./generateGPTMessage'); // 別途定義するGPTメッセージ生成
const generateFlexMessage = require('./flexBuilder'); // 別途定義するFlex定期診断カード

// ユーザー一覧取得（subscribed = true）
async function getSubscribedUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, line_id, subscribed, created_at')
    .eq('subscribed', true);

  if (error) throw error;
  return data;
}

// 日数計算ヘルパー
function getDaysSince(dateString) {
  const subscribedDate = new Date(dateString);
  const today = new Date();
  const diffTime = today - subscribedDate;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// メイン関数
async function sendReminders() {
  const users = await getSubscribedUsers();

  for (const user of users) {
    const days = getDaysSince(user.created_at);

    // ✅ 登録翌日（1日後）のメッセージ送信
    if (days === 1) {
      try {
        await line.client.pushMessage(user.line_id, {
          type: 'text',
          text:
            '今日から本格的に『ととのうケア習慣』、始めていきましょうね🌱\n\n' +
            '最初は「習慣改善」や「ストレッチ」など、できそうなことから1つで大丈夫。\n' +
            '焦らず、心地よくいきましょう🧘‍♂️'
        });
      } catch (err) {
        console.error(`❌ ${user.line_id} への初日メッセージ送信失敗:`, err);
      }
      continue;
    }

    // ⛔ 1日目・4日ごとのタイミング以外はスキップ
    if (days === 0 || days % 4 !== 0) continue;

    // 4×偶数 = GPTメッセージ、4×奇数 = Flex
    const isEvenCycle = (days / 4) % 2 === 0;

    try {
      if (isEvenCycle) {
        const followup = await getLatestFollowup(user.line_id);
        const gptMessage = await generateGPTMessage(followup);
        await line.client.pushMessage(user.line_id, { type: 'text', text: gptMessage });
      } else {
        const flex = generateFlexMessage();
        await line.client.pushMessage(user.line_id, flex);
      }
    } catch (err) {
      console.error(`❌ ${user.line_id} への送信失敗:`, err);
    }
  }
}

module.exports = sendReminders;
