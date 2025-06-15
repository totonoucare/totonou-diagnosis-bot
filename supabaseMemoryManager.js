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

async function getUser(lineId) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('line_id', lineId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function upsertUser(user) {
  const { error } = await supabase
    .from(TABLE_NAME)
    .upsert(user, { onConflict: ['line_id'] });
  if (error) throw error;
}

async function markSubscribed(lineId) {
  const { error } = await supabase
    .from(TABLE_NAME)
    .update({ subscribed: true })
    .eq('line_id', lineId);
  if (error) throw error;
}

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

async function getDiagnosis(lineId) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('diagnosis_result, totonou_guide')
    .eq('line_id', lineId)
    .single();

  if (error) throw error;
  return data;
}

async function saveContext(lineId, score1, score2, score3, flowType, organType, type, traits, adviceCards) {
  try {
    const context = {
      type,
      trait: traits,
      scores: [score1, score2, score3],
      advice: adviceCards
    };

    const { error } = await supabase
      .from(TABLE_NAME)
      .update({
        context: JSON.stringify(context)
      })
      .eq('line_id', lineId);

    if (error) throw error;
  } catch (err) {
    console.error('❌ Supabase context保存エラー:', err);
    throw err;
  }
}

async function getContext(lineId) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('context')
    .eq('line_id', lineId)
    .single();

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
  getUser,
  upsertUser,
  markSubscribed,
  saveDiagnosis,
  getDiagnosis,
  saveContext,
  getContext,
  setInitialContext: saveContext
};
