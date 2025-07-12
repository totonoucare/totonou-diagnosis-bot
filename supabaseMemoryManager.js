const supabase = require('./supabaseClient');

const CONTEXT_TABLE = 'contexts';
const USERS_TABLE = 'users';
const FOLLOWUP_TABLE = 'followups';

// JST現在時刻（ISO文字列）を取得
function getJSTISOStringNow() {
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jstNow.toISOString();
}

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

// ✅ サブスク登録処理
async function markSubscribed(lineId, options = {}) {
  const cleanId = lineId.trim();

  const updatePayload = {
    subscribed: true,
    subscribed_at: getJSTISOStringNow(),
  };

  if (options.plan_type) {
    updatePayload.plan_type = options.plan_type;
  }

  if (options.stripe_customer_id) {
    updatePayload.stripe_customer_id = options.stripe_customer_id;
  }

  const { error } = await supabase
    .from(USERS_TABLE)
    .update(updatePayload)
    .eq('line_id', cleanId);

  if (error) throw error;
}

// ✅ サブスク解約処理（解約時に呼び出す）
async function markUnsubscribed(lineId) {
  const cleanId = lineId.trim();

  const { error } = await supabase
    .from(USERS_TABLE)
    .update({
      subscribed: false,
      unsubscribed_at: getJSTISOStringNow(),
      plan_type: null,
      stripe_customer_id: null,
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
  if (error) throw error;
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
  if (error) throw error;
}

// ✅ 最新のcontext取得
async function getContext(lineId) {
  const cleanId = lineId.trim();
  const { data: userRow, error: userError } = await supabase
    .from(USERS_TABLE)
    .select('id, guide_received')
    .eq('line_id', cleanId)
    .maybeSingle();
  if (userError || !userRow) throw userError || new Error('ユーザーが見つかりません');

  const { data: context, error: contextError } = await supabase
    .from(CONTEXT_TABLE)
    .select('*')
    .eq('user_id', String(userRow.id))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (contextError) throw contextError;

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
  if (error) throw error;
}

// ✅ 最新のfollowup取得
async function getLatestFollowup(lineId) {
  const cleanId = lineId.trim();
  const { data: userRow, error: userError } = await supabase
    .from(USERS_TABLE)
    .select('id')
    .eq('line_id', cleanId)
    .maybeSingle();
  if (userError || !userRow) throw userError || new Error('ユーザーが見つかりません');

  const { data: followup, error: followupError } = await supabase
    .from(FOLLOWUP_TABLE)
    .select('*')
    .eq('user_id', userRow.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (followupError) throw followupError;
  return followup;
}

// ✅ サブスク登録ユーザー一覧取得
async function getSubscribedUsers() {
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select('id, line_id')
    .eq('subscribed', true);

  if (error) throw error;
  return data || [];
}

// ✅ 相談回数を加算（最大30）
async function incrementConsultationCount(lineId, amount = 5, max = 30) {
  const cleanId = lineId.trim();

  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select('remaining_consultations')
    .eq('line_id', cleanId)
    .maybeSingle();

  if (error || !data) throw error || new Error('ユーザーが見つかりません');

  const current = data.remaining_consultations || 0;
  const updated = Math.min(current + amount, max);

  const { error: updateError } = await supabase
    .from(USERS_TABLE)
    .update({ remaining_consultations: updated })
    .eq('line_id', cleanId);

  if (updateError) throw updateError;
  return updated;
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
  markUnsubscribed,
  markGuideReceived,
  saveContext,
  getContext,
  setInitialContext: saveContext,
  setFollowupAnswers,
  getLatestFollowup,
  getSubscribedUsers,
  incrementConsultationCount,
  updateUserFields
};
