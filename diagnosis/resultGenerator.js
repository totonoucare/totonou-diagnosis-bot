const resultDictionary = require("./resultDictionary");
const flowDictionary = require("./flowDictionary");
const flowlabelDictionary = require("./flowlabelDictionary");
const organDictionary = require("./organDictionary");
const adviceDictionary = require("./adviceDictionary");
const linkDictionary = require("./linkDictionary");
const stretchPointDictionary = require("./stretchPointDictionary");
const flowAdviceDictionary = require("./flowAdviceDictionary");
const getTypeName = require("./typeMapper");

function generateResult(score1, score2, score3, flowType, organType, symptom, motion) {
  const typeName = getTypeName(score1, score2, score3);

  console.log("📊 generateResult:");
  console.log(" score1,2,3:", score1, score2, score3);
  console.log(" typeName:", typeName);

  if (!typeName) {
    console.warn("⚠️ 未定義の体質タイプ：", score1, score2, score3);
    return {
      type: "不明な体質タイプ",
      traits: "",
      flowType,
      organType,
      symptom: symptom || "不明な不調",
      motion: motion || "特定の動作",
      flowIssue: flowDictionary[flowType] || "",
      organBurden: organDictionary[organType] || "",
      scores: [score1, score2, score3],
      adviceCards: [
        {
          header: "分析エラー",
          body: "スコアの組み合わせが未定義か、内部エラーが発生しています。",
        }
      ]
    };
  }

  // 各種情報の取得
  const baseInfo = resultDictionary[typeName] || {};
  const flowInfo = flowDictionary[flowType] || "";
  const organInfo = organDictionary[organType] || "";
  const baseAdvice = adviceDictionary[typeName] || "";

  // 呼吸法・ストレッチ・ツボ：構造が { text, link } になった前提
  const flowData = flowAdviceDictionary[flowType] || { text: "", link: "" };
  const stretchData = stretchPointDictionary[organType] || {
    stretch: { text: "", link: "" },
    points: { text: "", link: "" }
  };

  // flowlabel → 漢方リンク内に埋め込み
  const flowLabel = flowlabelDictionary[flowType] || "";
  const rawLinkText = linkDictionary[typeName] || "";
  const resolvedLink = rawLinkText.replace("{{flowlabel}}", flowLabel);

  // 📦 カルーセル用アドバイス構造化
  const adviceCards = [
    {
      header: "① 体質改善習慣💡",
      body: baseAdvice
    },
    {
      header: "② 巡りととのう呼吸法🧘",
      body: flowData.text,
      link: flowData.link || "https://totonoucare.jp/guide/breathing"
    },
    {
      header: "③ 経絡(けいらく)ストレッチ🤸",
      body: stretchData.stretch.text,
      link: stretchData.stretch.link || "https://totonoucare.jp/guide/stretch"
    },
    {
      header: "④ 指先・ツボほぐし 👍",
      body: stretchData.points.text,
      link: stretchData.points.link || "https://totonoucare.jp/guide/points"
    },
    {
      header: "⑤ 体質で選ぶオススメ漢方薬 🌿",
      body: resolvedLink
    }
  ];

  return {
    type: typeName,
    traits: baseInfo.traits || "",
    flowType,
    organType,
    symptom: symptom || "不明な不調",
    motion: motion || "特定の動作",
    flowIssue: flowInfo,
    organBurden: organInfo,
    adviceCards: adviceCards,
    scores: [score1, score2, score3]
  };
}

module.exports = generateResult;
