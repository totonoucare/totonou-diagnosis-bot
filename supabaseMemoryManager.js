const supabase = require('./supabaseClient');

const getTypeName = require('./diagnosis/typeMapper');
const resultDictionary = require('./diagnosis/resultDictionary');
const adviceDictionary = require('./diagnosis/adviceDictionary');
const flowAdviceDictionary = require('./diagnosis/flowAdviceDictionary');
const organDictionary = require('./diagnosis/organDictionary');
const stretchPointDictionary = require('./diagnosis/stretchPointDictionary');
const flowlabelDictionary = require('./diagnosis/flowlabelDictionary');
const linkDictionary = require('./diagnosis/linkDictionary');

const TABLE_NAME = 'users';
const FOLLOWUP_TABLE = 'followup_answers';

// ✅ ユーザー初期化（診断開始時に呼ぶ）
async function initializeUser(lineId) {
  const { error } = await supabase
    .from(TABLE_NAME)
    .upsert({ line_id: lineId }, { onConflict: ['line_id'] });

  if (error) throw error;
}

// ✅ ユーザー情報取得
async function getUser(lineId) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('line_id', lineId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ✅ サブスク登録フラグ
async function markSubscribed(lineId) {
  const { error } = await supabase
    .from(TABLE_NAME)
    .update({ subscribed: true })
    .eq('line_id', lineId);

  if (error) throw error;
}

// ✅ 診断データ保存（任意形式）
async function saveDiagnosis(lineId, diagnosisResult, totonouGuide) {
  const { error } = await supabase
    .from(TABLE_NAME)
    .update({
      diagnosis_result: diagnosisResult,
      totonou_guide: totonouGuide,
    })
    .eq('line_id', lineId);

  if (error) throw error;
}

// ✅ 診断データ取得
async function getDiagnosis(lineId) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('diagnosis_result, totonou_guide')
    .eq('line_id', lineId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ✅ context構造保存（体質・スコア・流れ・臓腑・アドバイス）
async function saveContext(lineId, score1, score2, score3, flowType, organType, type, traits, adviceCards, symptom, motion) {
  const context = {
    type,
    trait: traits,
    scores: [score1, score2, score3],
    flowType,
    organType,
    symptom: symptom || "不明な不調",
    motion: motion || "特定の動作",
    advice: adviceCards
  };

  const { error } = await supabase
    .from(TABLE_NAME)
    .upsert({ line_id: lineId, context }, { onConflict: ['line_id'] });

  if (error) {
    console.error('❌ Supabase context保存エラー:', error);
    throw error;
  }
}

// ✅ context構造取得
async function getContext(lineId) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('context')
    .eq('line_id', lineId)
    .maybeSingle();

  if (error) throw error;

  if (!data?.context) return null;

  try {
    return typeof data.context === 'string'
      ? JSON.parse(data.context)
      : data.context;
  } catch (err) {
    console.error('❌ contextのJSON parseに失敗:', err);
    return null;
  }
}

// ✅ 再診回答の保存（履歴形式で挿入）
async function setFollowupAnswers(lineId, answers) {
  try {
    // usersテーブルから user_id(uuid) を取得
    const { data: userRow, error: userError } = await supabase
      .from(TABLE_NAME)
      .select('id')
      .eq('line_id', lineId)
      .maybeSingle();

    if (userError || !userRow) throw userError || new Error('ユーザーが見つかりません');

    const userId = userRow.id;

    const multi = answers[5] || {};

    const payload = {
      user_id: userId,
      symptom_level: parseInt(answers[0]) || null,
      general_level: parseInt(answers[1]) || null,
      sleep: parseInt(answers[2]) || null,
      meal: parseInt(answers[3]) || null,
      stress: parseInt(answers[4]) || null,
      habits: multi.habits || null,
      breathing: multi.breathing || null,
      stretch: multi.stretch || null,
      tsubo: multi.tsubo || null,
      kampo: multi.kampo || null,
      motion_level: parseInt(answers[6]) || null,
      difficulty: answers[7] || null,
      created_at: new Date().toISOString()
    };

    const { error: insertError } = await supabase
      .from(FOLLOWUP_TABLE)
      .insert(payload); // 履歴として追加

    if (insertError) {
      console.error('❌ followup_answers保存エラー:', insertError);
      throw insertError;
    }

  } catch (err) {
    console.error('❌ setFollowupAnswers 実行時エラー:', err);
    throw err;
  }
}

module.exports = {
  initializeUser,
  getUser,
  upsertUser: initializeUser,
  markSubscribed,
  saveDiagnosis,
  getDiagnosis,
  saveContext,
  getContext,
  setInitialContext: saveContext,
  setFollowupAnswers
};
