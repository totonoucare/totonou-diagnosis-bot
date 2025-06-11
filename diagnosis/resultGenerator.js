const resultDictionary = require("./resultDictionary");
const flowDictionary = require("./flowDictionary");
const flowlabelDictionary = require("./flowlabelDictionary");
const organDictionary = require("./organDictionary");
const adviceDictionary = require("./adviceDictionary");
const linkDictionary = require("./linkDictionary");
const stretchPointDictionary = require("./stretchPointDictionary"); // 🆕 ツボ＆ストレッチ辞書
const flowAdviceDictionary = require("./flowAdviceDictionary");     // 🆕 巡りアドバイス辞書
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

  // 各種情報の取得
  const baseInfo = resultDictionary[typeName] || {};
  const flowInfo = flowDictionary[flowType] || "";
  const organInfo = organDictionary[organType] || "";
  const baseAdvice = adviceDictionary[typeName] || "";
  const stretchData = stretchPointDictionary[organType] || { stretch: "", points: [] };
  const flowCareAdvice = flowAdviceDictionary[flowType] || "";

  // 💡ととのう習慣アドバイスの統合生成
  const combinedAdvice = `【体質改善ヒント】\n${baseAdvice}\n\n【今日からできるストレッチ】\n${stretchData.stretch}\n\n【今日から取り入れたいツボ】\n${stretchData.points.join("・")}\n\n【巡りへのセルフケア】\n${flowCareAdvice}`;

  // flowlabel → リンク内に埋め込み処理
  const flowLabel = flowlabelDictionary[flowType] || "";
  const rawLinkText = linkDictionary[typeName] || "";
  const link = rawLinkText.replace("{{flowlabel}}", flowLabel);

  return {
    type: typeName,
    traits: baseInfo.traits || "",
    flowIssue: flowInfo,
    organBurden: organInfo,
    advice: combinedAdvice,
    link: link
  };
}

module.exports = generateResult;
