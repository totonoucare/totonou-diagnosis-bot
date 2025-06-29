const supabase = require('./supabaseClient');

const CONTEXT_TABLE = 'contexts';
const USERS_TABLE = 'users';
const FOLLOWUP_TABLE = 'followups';

// ✅ ユーザー初期化
async function initializeUser(lineId) {
  const cleanId = lineId.trim();
  const { error } = await supabase
    .from(USERS_TABLE)
    .upsert({ line_id: cleanId }, { onConflict: ['line_id'] });

  if (error) throw error;
}

// ✅ ユーザー情報取得
async function getUser(lineId) {
  const cleanId = lineId.trim();
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select('*')
    .eq('line_id', cleanId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ✅ サブスク登録フラグ + 登録日時保存
async function markSubscribed(lineId) {
  const cleanId = lineId.trim();
  const { error } = await supabase
    .from(USERS_TABLE)
    .update({
      subscribed: true,
      subscribed_at: new Date().toISOString(),
    })
    .eq('line_id', cleanId);

  if (error) throw error;
}

// ✅ ガイド初回受信フラグ
async function markGuideReceived(lineId) {
  const cleanId = lineId.trim();
  const { error } = await supabase
    .from(USERS_TABLE)
    .update({ guide_received: true })
    .eq('line_id', cleanId);

  if (error) {
    console.error("❌ markGuideReceived エラー:", error);
    throw error;
  }
}

// ✅ context保存
async function saveContext(lineId, score1, score2, score3, flowType, organType, type, traits, adviceCards, symptom, motion) {
  const cleanId = lineId.trim();
  const { data: userRow, error: userError } = await supabase
    .from(USERS_TABLE)
    .select('id')
    .eq('line_id', cleanId)
    .maybeSingle();

  if (userError || !userRow) throw userError || new Error('ユーザーが見つかりません');

  const payload = {
    user_id: userRow.id,
    type,
    trait: traits,
    scores: [score1, score2, score3],
    flowType,
    organType,
    symptom: symptom || '不明な不調',
    motion: motion || '特定の動作',
    advice: adviceCards
  };

  const { error } = await supabase
    .from(CONTEXT_TABLE)
    .insert(payload);

  if (error) {
    console.error('❌ context保存エラー:', error);
    throw error;
  }
}

// ✅ 最新のcontext取得（ログ＆user_id型変換付き）
async function getContext(lineId) {
  const cleanId = lineId.trim();
  const { data: userRow, error: userError } = await supabase
    .from(USERS_TABLE)
    .select('id, guide_received')
    .eq('line_id', cleanId)
    .maybeSingle();

  if (userError || !userRow) throw userError || new Error('ユーザーが見つかりません');

  // ✅ userRow.id のログ出力
  console.log("🧾 getContext() - userRow.id:", userRow.id);

  const { data: context, error: contextError } = await supabase
    .from(CONTEXT_TABLE)
    .select('*')
    .eq('user_id', String(userRow.id)) // ← ✅ 明示的に文字列化
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (contextError) {
    console.error('❌ context取得エラー:', contextError);
    throw contextError;
  }

  // ✅ context のログ出力
  console.log("📦 getContext() - context data:", context);

  return {
    ...context,
    guide_received: userRow.guide_received || false
  };
}

// ✅ フォローアップ回答保存
async function setFollowupAnswers(lineId, answers) {
  const cleanId = lineId.trim();
  const { data: userRow, error: userError } = await supabase
    .from(USERS_TABLE)
    .select('id')
    .eq('line_id', cleanId)
    .maybeSingle();

  if (userError || !userRow) throw userError || new Error('ユーザーが見つかりません');

  const payload = {
    user_id: userRow.id,
    symptom_level: parseInt(answers.symptom),
    general_level: parseInt(answers.general),
    sleep: parseInt(answers.sleep),
    meal: parseInt(answers.meal),
    stress: parseInt(answers.stress),
    habits: answers.habits,
    breathing: answers.breathing,
    stretch: answers.stretch,
    tsubo: answers.tsubo,
    kampo: answers.kampo,
    motion_level: parseInt(answers.motion_level),
    q5_answer: answers.q5_answer
  };

  for (const key in payload) {
    if (payload[key] === undefined || payload[key] === null || payload[key] === '') {
      throw new Error(`❌ 必須項目が未定義: ${key}`);
    }
  }

  const { error } = await supabase
    .from(FOLLOWUP_TABLE)
    .insert(payload);

  if (error) {
    console.error('❌ followup_answers保存エラー:', error);
    throw error;
  }
}

// ✅ 最新のfollowup取得
async function getLatestFollowup(lineId) {
  const cleanId = lineId.trim();
  const { data: userRow, error: userError } = await supabase
    .from(USERS_TABLE)
    .select('id')
    .eq('line_id', cleanId)
    .maybeSingle();

  if (userError || !userRow) {
    throw userError || new Error('ユーザーが見つかりません');
  }

  const { data: followup, error: followupError } = await supabase
    .from(FOLLOWUP_TABLE)
    .select('*')
    .eq('user_id', userRow.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (followupError) {
    console.error('❌ 最新フォローアップ取得エラー:', followupError);
    throw followupError;
  }

  return followup;
}

// ✅ サブスク登録ユーザー一覧取得（リマインド用）
async function getSubscribedUsers() {
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select('id, line_id')
    .eq('subscribed', true);

  if (error) {
    console.error("❌ サブスクユーザー取得エラー:", error);
    throw error;
  }

  return data || [];
}

// ✅ 将来拡張用
async function updateUserFields(lineId, updates) {
  console.warn("⚠️ updateUserFieldsは現在未使用です。呼び出されましたが処理は行っていません。");
  return;
}

module.exports = {
  initializeUser,
  getUser,
  upsertUser: initializeUser,
  markSubscribed,
  markGuideReceived,
  saveContext,
  getContext,
  setInitialContext: saveContext,
  setFollowupAnswers,
  getLatestFollowup,
  getSubscribedUsers,
  updateUserFields
};
