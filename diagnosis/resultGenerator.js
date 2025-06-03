const resultDictionary = require("./resultDictionary");
const flowDictionary = require("./flowDictionary");
const organDictionary = require("./organDictionary");
const adviceDictionary = require("./adviceDictionary");
const linkDictionary = require("./linkDictionary");
const getTypeName = require("./typeMapper");

function generateResult(score1, score2, score3, flowType, organType) {
  const typeName = getTypeName(score1, score2, score3);

  // ログ出力でトラブル時の原因追跡が可能に
  console.log("📊 generateResult:");
  console.log(" score1,2,3:", score1, score2, score3);
  console.log(" typeName:", typeName);

  if (!typeName) {
    console.warn("⚠️ 未定義の体質タイプ：", score1, score2, score3);
    return {
      type: "不明な体質タイプ",
      traits: "",
      flowIssue: flowDictionary[flowType] || "",
      organBurden: organDictionary[organType] || "",
      advice: "スコアの組み合わせが未定義か、内部エラーが発生しています。",
      link: ""
    };
  }

  const baseInfo = resultDictionary[typeName] || {};
  const flowInfo = flowDictionary[flowType] || "";
  const organInfo = organDictionary[organType] || "";
  const advice = adviceDictionary[typeName] || "";
  const link = linkDictionary[typeName] || "";

  return {
    type: typeName,
    traits: baseInfo.traits || "",
    flowIssue: flowInfo,
    organBurden: organInfo,
    advice: advice,
    link: link
  };
}

module.exports = generateResult;
