// carelog/gptPraise.js
// =======================================
// 🌿 ととのうケアナビ：ケア別トーン＆自然な褒めコメント＋称号保存
// - 各フェーズ5パターン（うち3つにケア名）
// - 節目対応：10, 30, 100, 300, 500, 700, 1000回
// - 称号を自動生成し、Supabase(users.care_titles)に保存
// =======================================

const { updateCareTitleByLineId } = require("../supabaseMemoryManager");

// 🌿 ケア表示名
const CARE_LABEL = {
  habits: "体質改善習慣",
  breathing: "呼吸法",
  stretch: "ストレッチ",
  tsubo: "ツボケア",
  kampo: "漢方ケア",
};

// 🌈 ケア別トーン絵文字
const CARE_TONE = {
  habits: "🌿",
  breathing: "🫁",
  stretch: "💪",
  tsubo: "🫶",
  kampo: "🍵",
};

// 🎯 節目回数リスト
const MILESTONES = [10, 30, 100, 300, 500, 700, 1000];

// 🌱 ステージ定義（回数でフェーズ分類）
const STAGES = [
  { name: "初期", min: 0, max: 29 },
  { name: "定着期", min: 30, max: 99 },
  { name: "継続期", min: 100, max: 299 },
  { name: "熟達期", min: 300, max: 699 },
  { name: "達人期", min: 700, max: Infinity },
];

// 🏅 称号生成
function getRankTitle(label, count) {
  if (count >= 1000) return `${label}名人`;
  if (count >= 700) return `${label}の楷`;
  if (count >= 300) return `${label}の匠`;
  if (count >= 100) return `${label}達人`;
  if (count >= 30) return `${label}上手`;
  if (count >= 10) return `${label}習慣者`;
  return `${label}はじめ`;
}

// 🎨 FlexボタンUI（そのまま）
function buildCareButtonsFlex() {
  const buttons = Object.entries(CARE_LABEL).map(([key, label]) => ({
    type: "button",
    style: "primary",
    height: "sm",
    color: "#7B9E76",
    action: { type: "message", label, text: `${label}完了☑️` },
  }));

  return {
    type: "flex",
    altText: "セルフケア実施記録",
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "🌿 実施したケアを記録", weight: "bold", size: "lg", color: "#ffffff" },
        ],
        backgroundColor: "#7B9E76",
        paddingAll: "12px",
        cornerRadius: "12px",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "box", layout: "vertical", spacing: "sm", margin: "md", contents: buttons },
        ],
      },
    },
  };
}

// 🌿 褒めメッセージ生成（称号保存付き）
async function generatePraiseReply({ lineId, pillarKey, countsAll }) {
  const label = CARE_LABEL[pillarKey] || "ケア";
  const tone = CARE_TONE[pillarKey] || "🌿";
  const count = countsAll[pillarKey] || 0;
  const total = Object.values(countsAll).reduce((a, b) => a + (b || 0), 0);

  const stage = STAGES.find((s) => count >= s.min && count <= s.max)?.name || "初期";
  const rank = getRankTitle(label, count); // ← 称号生成

  let message = "";

  // 🎯 節目優先コメント
  if (MILESTONES.includes(count)) {
    switch (count) {
      case 10:
        message = `${tone} ${label}10回！整いのリズムが生まれてきたね🌱`;
        break;
      case 30:
        message = `${tone} ${label}30回達成！習慣として定着してきた感じ✨`;
        break;
      case 100:
        message = `${tone} ${label}100回！日々の積み重ねが芯を作ってるね🌿`;
        break;
      case 300:
        message = `${tone} ${label}300回！安定した整い方、素敵です🕊️`;
        break;
      case 500:
        message = `${tone} ${label}500回！静かな継続に心から拍手👏`;
        break;
      case 700:
        message = `${tone} ${label}700回！整いがすっかり自分の一部に🌸`;
        break;
      case 1000:
        message = `${tone} ${label}1000回！その姿勢、まさに本物の達人✨`;
        break;
    }
  } else {
    // 🌿 通常ステージ別コメント
    switch (stage) {
      case "初期":
        message = random([
          `${tone} ${label}を重ねるたび、少しずつ整ってきてるね🌱`,
          `${tone} ${label}の時間が、体にやさしく響いてるね🌿`,
          `${tone} 無理なく続けられててすごく自然✨`,
          `${tone} 今日の小さな一歩、それが未来の整いにつながる🍃`,
          `${tone} 丁寧に続けてる感じ、とてもいいリズムだね🕊️`,
        ]);
        break;

      case "定着期":
        message = random([
          `${tone} ${label}が自然に日常に溶け込んできたね🌿`,
          `${tone} ${label}を続ける姿勢が安定感を作ってる✨`,
          `${tone} 継続の流れ、とても落ち着いてるね🕊️`,
          `${tone} 穏やかに整ってる、その感じすごくいい🍃`,
          `${tone} 体の声にちゃんと耳を傾けられてるね🌸`,
        ]);
        break;

      case "継続期":
        message = random([
          `${tone} ${label}の積み重ねが深い整いを生んでるね🌿`,
          `${tone} ${label}を軸にした生活、安定感ある✨`,
          `${tone} 落ち着いた整い方、とても自然で美しい🕊️`,
          `${tone} 静かに続けてる感じ、すばらしい流れ🌸`,
          `${tone} 体が整うリズムを自分で作れてるね🍵`,
        ]);
        break;

      case "熟達期":
        message = random([
          `${tone} 穏やかな継続が整いの深さを作ってるね🌿`,
          `${tone} ${label}が心と体をやさしく支えてる感じ✨`,
          `${tone} 整い方が落ち着いてて安定してるね🕊️`,
          `${tone} 丁寧に積み重ねてる姿勢が本当にすてき🌸`,
          `${tone} 静けさの中に芯の強さを感じる🍃`,
        ]);
        break;

      case "達人期":
        message = random([
          `${tone} ${label}がもう呼吸みたいな存在だね🌿`,
          `${tone} 穏やかでブレない整い、まさに達人の域👏`,
          `${tone} 静かに続けている姿がとても尊い🕊️`,
          `${tone} 整いの深さがまぶしいほど✨`,
          `${tone} 習慣じゃなく、"生き方"として整ってるね🌸`,
        ]);
        break;
    }
  }

  // ⚖️ バランス補足（偏りチェック）
  const ratio = total ? count / total : 0;
  if (ratio > 0.45 && ratio < 0.55 && total > 4) {
    message += "\n\n🍃 他のケアも少し取り入れると、さらに整いやすいよ。";
  }

  // 🏅 称号を付加して保存
  message += `\n\n${tone} 今日からあなたは【${rank}】です！🏅`;
  try {
    await updateCareTitleByLineId(lineId, pillarKey, rank);
  } catch (err) {
    console.error("❌ updateCareTitleByLineId error:", err);
  }

  return message;
}

/** 🎲 ランダム選択ユーティリティ */
function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = { generatePraiseReply, buildCareButtonsFlex };
