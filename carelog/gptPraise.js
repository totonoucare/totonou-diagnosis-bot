// carelog/gptPraise.js
const { OpenAI } = require("openai");
const oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CARE_LABEL = {
  habits: "体質改善習慣",
  breathing: "呼吸法",
  stretch: "ストレッチ",
  tsubo: "ツボ",
  kampo: "漢方",
};

function buildCareButtonsFlex() {
  const buttons = Object.entries(CARE_LABEL).map(([key, label]) => ({
    type: "button",
    style: "primary",
    height: "sm",
    color: "#7B9E76",
    action: { type: "message", label, text: `${label}ケア完了☑️` },
  }));

  return {
    type: "flex",
    altText: "実施記録",
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "🌿 実施したケアを記録",
            weight: "bold",
            size: "lg",
            color: "#ffffff",
          },
        ],
        backgroundColor: "#7B9E76",
        paddingAll: "12px",
        cornerRadius: "12px",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            margin: "md",
            contents: buttons,
          },
        ],
      },
    },
  };
}

/**
 * ケア実施褒めメッセージ生成
 * totalはGPTに渡さず、JS側で条件に応じて追記する
 */
async function generatePraiseReply({ pillarKey, countsAll }) {
  const label = CARE_LABEL[pillarKey] || "ケア";
  const count = countsAll[pillarKey] || 0;
  const total = Object.values(countsAll).reduce((a, b) => a + (b || 0), 0);

  const system = `
あなたはセルフケアを褒めるAIパートナー『トトノウくん』です。
各ケア項目（体質改善習慣・呼吸法・ストレッチ・ツボ・漢方）ごとに、
ユーザーの積み重ねを優しく褒めて、次へのやる気につながる一言を70字前後で出してください。

【ルール】
- 今回押されたケア項目を中心に褒める。
- パートナーらしく温かく、短文＋絵文字もOK。
- 否定・命令は禁止。
  `.trim();

  // 👇 totalは一切渡さない
  const user = `
【今回】${label} +1回
【このケアの累計】${count}回

※中心的に褒める対象は「${label}」です。
※「${count}」は、10回目・50回目・100回目など節目のときだけメッセージ内で触れてください。
  `.trim();

  const rsp = await oai.responses.create({
    model: process.env.TOTONOU_PRAISE_MODEL || "gpt-5-mini",
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    reasoning: { effort: "minimal" },
  });

  let praise =
    rsp.output_text?.trim() ||
    rsp.output?.[0]?.content?.map((c) => c?.text || "").join("\n").trim() ||
    `記録しました✅ ${label}の積み重ね、良い感じです！`;

  // 🩵 JS側で条件追加（count/total ≈ 0.5）
  const ratio = total ? count / total : 0;
  if (ratio > 0.45 && ratio < 0.55 && total > 4) {
    praise += "\n\n他のケアも少しずつ取り入れると、さらに整いやすいよ🌿";
  }

  return praise;
}

module.exports = { generatePraiseReply, buildCareButtonsFlex };
