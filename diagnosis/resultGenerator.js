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

  // 🔒 体質タイプが未定義だった場合の安全装置（元のまま）
  if (!typeName) {
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

  // ==========================
  // ① 辞書データ（元のまま）
  // ==========================
  const baseInfo = resultDictionary[typeName] || {};
  const flowInfo = flowDictionary[flowType] || "";
  const organInfo = organDictionary[organType] || "";
  const baseAdvice = adviceDictionary[typeName] || "";

  const flowData = flowAdviceDictionary[flowType] || { text: "", link: "" };
  const stretchData = stretchPointDictionary[organType] || {
    stretch: { text: "", link: "" },
    points: { text: "", link: "" }
  };

  // flowlabel → link内部置換（元のまま）
  const flowLabel = flowlabelDictionary[flowType] || "";
  const rawLinkText = linkDictionary[typeName] || "";
  const resolvedLink = rawLinkText.replace("{{flowlabel}}", flowLabel);

  // ==========================
  // ② カルーセル（元のまま）
  // ==========================
  const adviceCards = [
    {
      header: "① 体質改善習慣💡",
      body: baseAdvice,
    },
    {
      header: "② 巡りととのう呼吸法🧘",
      body: flowData.text,
      link: flowData.link,
    },
    {
      header: "③ 経絡(けいらく)ストレッチ🤸",
      body: stretchData.stretch.text,
      link: stretchData.stretch.link,
    },
    {
      header: "④ 指先・ツボほぐし 👍",
      body: stretchData.points.text,
      link: stretchData.points.link,
    },
    {
      header: "⑤ 体質で選ぶオススメ漢方薬 🌿",
      body: resolvedLink,
    },
  ];

  // ==========================
  // ③ 新：統合ストーリー（追加）
  // ==========================
  const symptomText = symptom
    ? `あなたが今気にされている「${symptom}」は、`
    : `現在気になっている不調は、`;

  const baseText = baseInfo.traits
    ? `まず体質として「${typeName}」の特徴があり、${baseInfo.traits}`
    : `まず体質として「${typeName}」の特徴があります。`;

  const flowText = flowInfo
    ? `その影響で「${flowType}」の傾向があらわれやすく、${flowInfo}`
    : "";

  const organText = organInfo
    ? `さらに、この巡りの偏りが「${organType}」の経絡（身体の特定のライン）に局在し、負担があらわれています。${organInfo}`
    : "";

  const summaryText = `
以上より、
① 体質（根本）  
② 巡り（流れ）  
③ 経絡（偏りの局在）  

の3層が連動して今の不調につながっている状態です。
`;

  const fullStory = `
${symptomText}
${baseText}

${flowText}

${organText}

${summaryText}
`.trim();

  // ==========================
  // ④ 返却（元+追加）
  // ==========================
  return {
    type: typeName,
    traits: baseInfo.traits || "",
    flowType,
    organType,
    symptom: symptom || "",
    motion: motion || "",
    flowIssue: flowInfo,
    organBurden: organInfo,
    adviceCards,
    scores: [score1, score2, score3],

    // 追加（Flexに使える）
    fullStory,

    // 後でさらに UIを賢くするとき用
    layers: {
      base: {
        type: typeName,
        traits: baseInfo.traits,
        advice: baseAdvice,
        link: resolvedLink,
      },
      flow: {
        type: flowType,
        description: flowInfo,
        advice: flowData,
      },
      organ: {
        type: organType,
        description: organInfo,
        stretch: stretchData.stretch,
        points: stretchData.points,
      },
    },
  };
}

module.exports = generateResult;
