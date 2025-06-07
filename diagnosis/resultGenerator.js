const resultDictionary = require("./resultDictionary");
const flowDictionary = require("./flowDictionary");
const flowlabelDictionary = require("./flowlabelDictionary"); // 追加
const organDictionary = require("./organDictionary");
const adviceDictionary = require("./adviceDictionary");
const linkDictionary = require("./linkDictionary");
const getTypeName = require("./typeMapper");

function generateResult(score1, score2, score3, flowType, organType) {
  const typeName = getTypeName(score1, score2, score3);

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

  // flowlabelを埋め込む（fallbackは空文字）
  const flowLabel = flowlabelDictionary[flowType] || "";
  const rawLinkText = linkDictionary[typeName] || "";
  const link = rawLinkText.replace("{{flowlabel}}", flowLabel);

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
