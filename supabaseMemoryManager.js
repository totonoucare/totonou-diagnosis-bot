const supabase = require('./supabaseClient');

const CONTEXT_TABLE = 'contexts';
const USERS_TABLE = 'users';
const FOLLOWUP_TABLE = 'followups';

// ✅ ユーザー初期化
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

// ✅ 再診：フォローアップ回答保存
async function setFollowupAnswers(lineId, answers) {
  const { data: userRow, error: userError } = await supabase
    .from(USERS_TABLE)
    .select('id')
    .eq('line_id', lineId)
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
    motion_level: parseInt(answers.motion),
    q5_answer: answers.Q5   // ← ここが修正ポイント
  };

  // 欠損チェック（null, undefined, 空文字をエラーに）
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
