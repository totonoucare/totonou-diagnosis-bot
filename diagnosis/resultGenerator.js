const resultDictionary = require('./dictionaries/resultDictionary');
const flowDictionary = require('./dictionaries/flowDictionary');
const organDictionary = require('./dictionaries/organDictionary');

/**
 * Q1〜Q3のスコア（-1, 0, +1）をもとに体質キーを作成する
 */
function getKeyFromScores(q1, q2, q3) {
  return `${q1}_${q2}_${q3}`;
}

/**
 * 体質スコアと巡り・臓腑から総合結果を出力
 */
function generateResult(q1, q2, q3, q4, q5) {
  const key = getKeyFromScores(q1, q2, q3);
  const baseResult = resultDictionary[key];

  if (!baseResult) {
    return {
      type: "不明",
      traits: "該当する体質タイプが見つかりませんでした。",
      flowIssue: "巡りの情報なし",
      organBurden: "臓腑の情報なし",
      advice: "もう一度診断をやり直してみてください。",
      link: "https://note.com"
    };
  }

  return {
    type: baseResult.type,
    traits: baseResult.traits,
    flowIssue: flowDictionary[q4] || "巡りの情報なし",
    organBurden: organDictionary[q5] || "臓腑の情報なし",
    advice: baseResult.advice,
    link: baseResult.link
  };
}

module.exports = { generateResult };
