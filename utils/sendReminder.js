const supabase = require('../supabaseClient');
const line = require('../line');
const { getLatestFollowup } = require('../supabaseMemoryManager');
const generateGPTMessage = require('./generateGPTMessage');
const generateFlexMessage = require('./flexBuilder');

// ✅ JST補正を適用して現在のJST時刻を取得
function getJSTDate() {
  const utc = new Date();
  utc.setHours(utc.getHours() + 9);
  return utc;
}

// ✅ JST時刻から "HH:MM" の形式を得る
function getCurrentJSTTimeString() {
  const jst = getJSTDate();
  const hh = jst.getHours().toString().padStart(2, '0');
  const mm = jst.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

// ✅ JSTベースで日数を計算
function getDaysSince(dateString) {
  const subscribedDate = new Date(dateString);
  subscribedDate.setHours(subscribedDate.getHours() + 9); // JST補正

  const today = getJSTDate(); // JST補正済み
  const diffTime = today - subscribedDate;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// ✅ subscribedユーザー一覧取得
async function getSubscribedUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, line_id, subscribed, created_at')
    .eq('subscribed', true);

  if (error) throw error;
  return data;
}

// ✅ メイン関数
async function sendReminders() {
  const users = await getSubscribedUsers();
  const currentTime = getCurrentJSTTimeString();

  for (const user of users) {
    const days = getDaysSince(user.created_at);

    // ✅ 翌日AM8:00に送信
    if (days === 1 && currentTime === '08:00') {
      try {
        await line.client.pushMessage(user.line_id, {
          type: 'text',
          text:
            '今日から本格的に『ととのうケア習慣』、始めていきましょうね🌱\n\n' +
            '最初は「習慣改善」や「ストレッチ」など、できそうなことから1つで大丈夫。\n' +
            '焦らず、心地よくいきましょう🧘‍♂️🍵'
        });
      } catch (err) {
        console.error(`❌ ${user.line_id} への初日メッセージ送信失敗:`, err);
      }
      continue;
    }

    // ✅ 4の倍数日かつ PM8:00 のみ送信
    if (days > 0 && days % 4 === 0 && currentTime === '20:00') {
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
}

module.exports = sendReminders;
