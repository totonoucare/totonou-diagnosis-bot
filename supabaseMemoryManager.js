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
    .maybeSingle(); // ← 0件でもOKにする

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

// ✅ 診断データ保存
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

// ✅ context構造保存（体質・スコア・アドバイス）
async function saveContext(lineId, score1, score2, score3, flowType, organType, type, traits, adviceCards) {
  const context = {
    type,
    trait: traits,
    scores: [score1, score2, score3],
    advice: adviceCards
  };

  const { error } = await supabase
    .from(TABLE_NAME)
    .upsert(
      { line_id: lineId, context },
      { onConflict: ['line_id'] }
    );

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

module.exports = {
  initializeUser, // ← startSession()から呼べる
  getUser,
  upsertUser: initializeUser, // 互換性維持
  markSubscribed,
  saveDiagnosis,
  getDiagnosis,
  saveContext,
  getContext,
  setInitialContext: saveContext // 別名互換
};
