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
    style: "primary", // ← secondary だと背景がグレー、primaryでカラー指定が効く
    height: "sm",
    color: "#7B9E76", // ← 希望カラー
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
async function generatePraiseReply({ pillarKey, countsAll }) {
  const label = CARE_LABEL[pillarKey] || "ケア";
  const count = countsAll[pillarKey] || 0;
  const total = Object.values(countsAll).reduce((a, b) => a + (b || 0), 0);

  const system = `
あなたはセルフケアを褒めるAIパートナー『トトノウくん』です。
各ケア項目（体質改善習慣・呼吸法・ストレッチ・ツボケア・漢方）ごとに、
ユーザーの積み重ねを優しく褒めて、次へのやる気につながる一言を70字前後で出してください。

【ルール】
- 今回押されたケア項目を中心に褒める。
- フレンドリーで温かく、短文＋絵文字もOK。
- 否定・命令・専門用語は禁止。
  `.trim();

  const user = `
【今回】${label} +1回
【このケアの累計】${count}回
【他のケアも含めた回数】${total}回（参考）

※中心的に褒める対象は「${label}」です。
※「${count}」は、10回目や50回目、100回目など、節目の回数のときにだけ出してあげること。
※「${total}」は、${count}/${total}＝1/2になるようなときにだけ、このケア以外の他のケアにももう少し注力するよう優しく指摘すること。
  `.trim();

  const rsp = await oai.responses.create({
    model: process.env.TOTONOU_PRAISE_MODEL || "gpt-5-mini",
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
