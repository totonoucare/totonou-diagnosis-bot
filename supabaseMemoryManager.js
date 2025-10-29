const supabase = require('./supabaseClient');

const CONTEXT_TABLE = 'contexts';
const USERS_TABLE = 'users';
const FOLLOWUP_TABLE = 'followups';
const CONSULT_TABLE = 'consult_histories'; // ← 追加

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
    trial_intro_done: false,       // ← ここで false に戻す
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
async function saveContext(lineId, score1, score2, score3, flowType, organType, type, traits, adviceCards, symptom, motion, code) {
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
    advice: adviceCards,
    code: code || null
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
    start_date: context?.created_at || null,  // ← ここを追加！
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
  sleep: parseInt(answers.sleep),
  meal: parseInt(answers.meal),
  stress: parseInt(answers.stress),
  habits: answers.habits,
  breathing: answers.breathing,
  stretch: answers.stretch,
  tsubo: answers.tsubo,
  kampo: answers.kampo,
  motion_level: parseInt(answers.motion_level),
  // q5_answer:  ← 削除
};

// 必須キーのみチェック（q5 は対象外）
const requiredKeys = [
  'user_id','symptom_level','sleep','meal','stress','motion_level'
];
for (const key of requiredKeys) {
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

// ✅ GPT診断コメントを生成対象とするユーザー一覧を取得
// trial_intro_done = true または subscribed = true のユーザーを取得
async function getSubscribedUsers() {
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select('id, line_id')
    .or('subscribed.eq.true,trial_intro_done.eq.true');

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

// どこでもOK（exportsの上）に追記

// 直近2件の followup を user_id で取得（[最新, その前]）— 安定ソート版
// supabaseMemoryManager.js 内
async function getLastTwoFollowupsByUserId(userId) {
  const uid = String(userId);

  const { data, error } = await supabase
    .from(FOLLOWUP_TABLE)
    .select('*')
    .eq('user_id', uid)
    // 同秒タイムスタンプ対策：二次ソートで id DESC を併用
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(2);

  if (error) throw error;

  const latest = (data && data[0]) ? data[0] : null;
  const prev   = (data && data[1]) ? data[1] : null;

  // ▼ ここ重要：何を拾えているかを必ず出す
  console.log("[getLastTwoFollowupsByUserId] uid=", uid, 
    "count=", data?.length || 0,
    "latest=", latest ? { id: latest.id, created_at: latest.created_at, user_id: latest.user_id } : null,
    "prev=",   prev   ? { id: prev.id,   created_at: prev.created_at,   user_id: prev.user_id   } : null
  );

  return { latest, prev };
}

/* ---------------------------
   ここから相談履歴（新規）
--------------------------- */

// ✅ 相談ログ保存（1メッセージ＝1行）
async function saveConsultMessage(userId, role, message) {
  const payload = {
    user_id: String(userId),
    role: role === 'assistant' ? 'assistant' : 'user',
    message: String(message || ''),
  };
  const { error } = await supabase.from(CONSULT_TABLE).insert(payload);
  if (error) throw error;
}

// ✅ 直近N件（デフォ3件）を取得（古→新に並べ替えて返す）
async function getLastNConsultMessages(userId, n = 3) {
  const { data, error } = await supabase
    .from(CONSULT_TABLE)
    .select('role, message, created_at')
    .eq('user_id', String(userId))
    .order('created_at', { ascending: false })
    .limit(n);
  if (error) throw error;
  return (data || []).reverse();
}

// ===== 実施ログ（care_logs_daily）ユーティリティ =====

// JST の "YYYY-MM-DD" を返す
function jstDateString() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9*60*60*1000);
  return jst.toISOString().slice(0, 10); // 例: "2025-10-28"
}

/**
 * 当日の care_logs_daily を +1（同日・同pillarは加算）
 * @param {string} lineId - LINEのuserId
 * @param {'habits'|'breathing'|'stretch'|'tsubo'|'kampo'} pillar
 */
async function addCareLogDailyByLineId(lineId, pillar) {
  const cleanId = String(lineId || "").trim();

  // users.id を取得
  const { data: userRow, error: userError } = await supabase
    .from(USERS_TABLE)
    .select('id')
    .eq('line_id', cleanId)
    .maybeSingle();
  if (userError || !userRow) throw userError || new Error('ユーザーが見つかりません');

  const day = jstDateString();

  // 既存行の有無を確認 → あれば count+1、なければ insert
  const { data: existing, error: selErr } = await supabase
    .from('care_logs_daily')
    .select('id, count')
    .eq('user_id', userRow.id)
    .eq('pillar', pillar)
    .eq('day', day)
    .maybeSingle();
  if (selErr) throw selErr;

  if (existing) {
    const { error: updErr } = await supabase
      .from('care_logs_daily')
      .update({ count: (existing.count || 0) + 1 })
      .eq('id', existing.id);
    if (updErr) throw updErr;
  } else {
    const { error: insErr } = await supabase
      .from('care_logs_daily')
      .insert({ user_id: userRow.id, pillar, day, count: 1 });
    if (insErr) throw insErr;
  }
}

/**
 * 直近の「ととのい度チェック日」以降の回数（pillar単体）
 * - 最新 followups.created_at の翌日(=JST基準)以降として扱う
 * - followup が無ければ 直近7日間 を窓にする
 * @param {string} lineId
 * @param {'habits'|'breathing'|'stretch'|'tsubo'|'kampo'} pillar
 * @returns {number} 合計回数
 */
async function getCareCountSinceLastFollowupByLineId(lineId, pillar) {
  const cleanId = String(lineId || "").trim();

  // users.id
  const { data: userRow, error: userError } = await supabase
    .from(USERS_TABLE)
    .select('id')
    .eq('line_id', cleanId)
    .maybeSingle();
  if (userError || !userRow) throw userError || new Error('ユーザーが見つかりません');

  // 最新 followup の日時（UTC保管想定）→ JST に換算して "YYYY-MM-DD"
  const { data: fu, error: fuErr } = await supabase
    .from(FOLLOWUP_TABLE)
    .select('created_at')
    .eq('user_id', userRow.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (fuErr) throw fuErr;

  let sinceDate;
  if (fu?.created_at) {
    const created = new Date(fu.created_at);
    // JST境界で数えやすくするため +9h
    sinceDate = new Date(created.getTime() + 9*60*60*1000);
  } else {
    // followupが無ければ 直近7日
    sinceDate = new Date(Date.now() - 7*24*60*60*1000);
  }
  const sinceStr = sinceDate.toISOString().slice(0, 10);

  const { data: rows, error: sumErr } = await supabase
    .from('care_logs_daily')
    .select('count')
    .eq('user_id', userRow.id)
    .eq('pillar', pillar)
    .gte('day', sinceStr);
  if (sumErr) throw sumErr;

  return (rows || []).reduce((acc, r) => acc + (r.count || 0), 0);
}

/**
 * 上と同じ条件で、5本柱すべての回数をまとめて返す
 * @param {string} lineId
 * @returns {{habits:number,breathing:number,stretch:number,tsubo:number,kampo:number}}
 */
async function getAllCareCountsSinceLastFollowupByLineId(lineId) {
  const pillars = ['habits','breathing','stretch','tsubo','kampo'];
  const result = {};
  for (const p of pillars) {
    try {
      result[p] = await getCareCountSinceLastFollowupByLineId(lineId, p);
    } catch {
      result[p] = 0;
    }
  }
  return result;
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
  updateUserFields,
  getLastTwoFollowupsByUserId,
  // 新規
  saveConsultMessage,
  getLastNConsultMessages,
  // 実施ログ（new）
  addCareLogDailyByLineId,
  getCareCountSinceLastFollowupByLineId,
  getAllCareCountsSinceLastFollowupByLineId,
};
