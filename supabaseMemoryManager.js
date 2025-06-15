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

async function saveContext(lineId, score1, score2, score3, flowType, organType) {
  const type = getTypeName(score1, score2, score3);
  const trait = resultDictionary[type]?.traits || "";

  const baseAdvice = adviceDictionary[type] || "";
  const breathing = flowAdviceDictionary[flowType] || "";

  const stretchData = stretchPointDictionary[organType] || { stretch: "", points: "" };
  const stretch = stretchData.stretch || "";
  const acupoint = stretchData.points || "";

  const flowLabel = flowlabelDictionary[flowType] || "";
  const rawLinkText = linkDictionary[type] || "";
  const kampo = rawLinkText.replace("{{flowlabel}}", flowLabel);

  const context = {
    type,
    trait,
    scores: [score1, score2, score3], // 保存用スコア
    advice: {
      habit: baseAdvice,
      breathing,
      stretch,
      acupoint,
      kampo
    }
  };

  const { error } = await supabase
    .from(TABLE_NAME)
    .update({ context })
    .eq('line_id', lineId);

  if (error) throw error;
}

async function getContext(lineId) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('context')
    .eq('line_id', lineId)
    .single();

  if (error) throw error;
  return data?.context || null;
}

module.exports = {
  getUser,
  upsertUser,
  markSubscribed,
  saveDiagnosis,
  getDiagnosis,
  saveContext,
  getContext,
};
