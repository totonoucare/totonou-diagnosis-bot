const supabase = require('./supabaseClient');

const CONTEXT_TABLE = 'contexts';
const USERS_TABLE = 'users';
const FOLLOWUP_TABLE = 'followups';

// ✅ ユーザー初期化（診断開始時に呼ぶ）
async function initializeUser(lineId) {
  const { error } = await supabase
    .from(USERS_TABLE)
    .upsert({ line_id: lineId }, { onConflict: ['line_id'] });

  if (error) throw error;
}

// ✅ ユーザー情報取得
async function getUser(lineId) {
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select('*')
    .eq('line_id', lineId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ✅ サブスク登録フラグ
async function markSubscribed(lineId) {
  const { error } = await supabase
    .from(USERS_TABLE)
    .update({ subscribed: true })
    .eq('line_id', lineId);

  if (error) throw error;
}

// ✅ context保存（診断結果＋アドバイス構造）
async function saveContext(lineId, score1, score2, score3, flowType, organType, type, traits, adviceCards, symptom, motion) {
  const { data: userRow, error: userError } = await supabase
    .from(USERS_TABLE)
    .select('id')
    .eq('line_id', lineId)
    .maybeSingle();

  if (userError || !userRow) throw userError || new Error('ユーザーが見つかりません');

  const payload = {
    user_id: userRow.id,
    type,
    trait: traits,
    scores: [score1, score2, score3],
    flow_issue: flowType,
    organ_burden: organType,
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

// ✅ 最新のcontext取得（直近1件）
async function getContext(lineId) {
  const { data: userRow, error: userError } = await supabase
    .from(USERS_TABLE)
    .select('id')
    .eq('line_id', lineId)
    .maybeSingle();

  if (userError || !userRow) throw userError || new Error('ユーザーが見つかりません');

  const { data, error } = await supabase
    .from(CONTEXT_TABLE)
    .select('*')
    .eq('user_id', userRow.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('❌ context取得エラー:', error);
    throw error;
  }

  return data;
}

// ✅ 再診：フォローアップ回答保存（完全履歴式）
async function setFollowupAnswers(lineId, answers) {
  const { data: userRow, error: userError } = await supabase
    .from(USERS_TABLE)
    .select('id')
    .eq('line_id', lineId)
    .maybeSingle();

  if (userError || !userRow) throw userError || new Error('ユーザーが見つかりません');

  const multi = answers[5] || {};

  const payload = {
    user_id: userRow.id,
    symptom_level: parseInt(answers[0].symptom),
    general_level: parseInt(answers[0].general),
    sleep: parseInt(answers[1].sleep),
    meal: parseInt(answers[1].meal),
    stress: parseInt(answers[1].stress),
    habits: multi.habits,
    breathing: multi.breathing,
    stretch: multi.stretch,
    tsubo: multi.tsubo,
    kampo: multi.kampo,
    motion_level: parseInt(answers[6]),
    difficulty: answers[7]
  };

  // 欠損チェック
  const requiredFields = Object.keys(payload);
  for (const key of requiredFields) {
    if (payload[key] === undefined || payload[key] === null) {
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

module.exports = {
  initializeUser,
  getUser,
  upsertUser: initializeUser,
  markSubscribed,
  saveContext,
  getContext,
  setInitialContext: saveContext,
  setFollowupAnswers
};
