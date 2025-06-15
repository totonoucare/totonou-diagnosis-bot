// supabaseMemoryManager.js
const supabase = require('./supabaseClient');
const getTypeName = require('../diagnosis/typeMapper');
const resultDictionary = require('../diagnosis/resultDictionary');
const adviceDictionary = require('../diagnosis/adviceDictionary');
const flowAdviceDictionary = require('../diagnosis/flowAdviceDictionary');
const organDictionary = require('../diagnosis/organDictionary');
const linkDictionary = require('../diagnosis/linkDictionary');

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

  const advice = {
    habit: adviceDictionary[type] || "",
    breathing: flowAdviceDictionary[flowType] || "",
    stretch: organDictionary[organType] || "",
    acupoint: "",  // あれば別途ファイルから取得して追記OK
    kampo: "",     // あれば別途ファイルから取得して追記OK
  };

  const context = { type, trait, advice };

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
