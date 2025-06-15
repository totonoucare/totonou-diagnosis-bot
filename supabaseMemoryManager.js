// supabaseMemoryManager.js
const supabase = require('./supabaseClient');

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

module.exports = {
  getUser,
  upsertUser,
  markSubscribed,
  saveDiagnosis,
  getDiagnosis,
};
