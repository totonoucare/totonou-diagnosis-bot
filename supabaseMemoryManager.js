// supabaseMemoryManager.js
const supabase = require('./supabaseClient');

const TABLE_NAME = 'users';

async function getUser(lineId) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('line_id', lineId)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // not found 以外は例外
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

module.exports = {
  getUser,
  upsertUser,
  markSubscribed,
};
