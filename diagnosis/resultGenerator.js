const resultDictionary = require("./resultDictionary");
const flowDictionary = require("./flowDictionary");
const organDictionary = require("./organDictionary");
const adviceDictionary = require("./adviceDictionary");
const linkDictionary = require("./linkDictionary");
const getTypeName = require("./typeMapper");

function generateResult(score1, score2, score3, flowType, organType) {
  const typeName = getTypeName(score1, score2, score3);
  const baseInfo = resultDictionary[typeName] || {};
  const flowInfo = flowDictionary[flowType] || "";
  const organInfo = organDictionary[organType] || "";
  const advice = adviceDictionary[typeName] || "";
  const link = linkDictionary[typeName] || "";

  return {
    type: typeName || "不明な体質タイプ",
    traits: baseInfo.traits || "",
    flowIssue: flowInfo,
    organBurden: organInfo,
    advice: advice,
    link: link
  };
}

module.exports = generateResult;
