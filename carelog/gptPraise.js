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
    style: "secondary",
    height: "sm",
    action: { type: "message", label, text: `${label}ケア完了☑️` },
  }));
  return {
    type: "flex",
    altText: "実施記録",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "実施したケアを記録", weight: "bold", size: "lg" },
          { type: "box", layout: "vertical", spacing: "sm", margin: "md", contents: buttons },
        ],
      },
    },
  };
}

async function generatePraiseReply({ pillarKey, countsAll }) {
  const label = CARE_LABEL[pillarKey] || "ケア";
  const count = countsAll[pillarKey] || 0;
  const total = Object.values(countsAll).reduce((a, b) => a + (b || 0), 0);

  const system = `あなたはセルフケアを褒める日本語コーチ。70〜120字以内で優しい励ましを出してください。`;
  const user = `項目:${label}\n今回:+1回\n直近レビュー以降:${count}回（全体:${total}回）`;

  const rsp = await oai.responses.create({
    model: process.env.TOTONOU_PRAISE_MODEL || "gpt-5-nano",
    input: [{ role: "system", content: system }, { role: "user", content: user }],
    reasoning: { effort: "minimal" },
  });

  return (
    rsp.output_text ||
    rsp.output?.[0]?.content?.map((c) => c?.text || "").join("\n").trim() ||
    `記録しました✅ ${label}の積み重ね、良い感じです！`
  );
}

module.exports = { generatePraiseReply, buildCareButtonsFlex };
