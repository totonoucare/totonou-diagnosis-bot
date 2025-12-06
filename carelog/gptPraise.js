// carelog/gptPraise.js
// =======================================
// 🌿 ととのうケアナビ：ケア別トーン＆自然な褒めコメント＋称号保存
// - 各フェーズ5パターン（うち3つにケア名）
// - 節目対応：10, 30, 100, 300, 700, 1000回
// - 称号を自動生成し、Supabase(users.care_titles)に保存
// - 同じ称号のときは再通知しない
// - 実施直後にミニフレックスで称号進捗を可視化
// =======================================

const {
  updateCareTitleByLineId,
  getCareTitlesByLineId,
} = require("../supabaseMemoryManager");

// 🌿 ケア表示名（ボタン表示用：長い）
const CARE_LABEL_DISPLAY = {
  habits: "体質改善習慣",
  breathing: "巡りととのう呼吸法",
  stretch: "経絡ストレッチ",
  tsubo: "指先・ツボケア",
  kampo: "漢方・サプリ（任意）",
};

// 💬 内部処理・称号用（短い）
const CARE_LABEL = {
  habits: "体質改善習慣",
  breathing: "呼吸法",
  stretch: "ストレッチ",
  tsubo: "ツボケア",
  kampo: "漢方・サプリ",
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
const MILESTONES = [10, 30, 100, 300, 700, 1000];

// 🌱 ステージ定義（通常コメントの雰囲気分け）
const STAGES = [
  { name: "初期", min: 0, max: 29 },
  { name: "定着期", min: 30, max: 99 },
  { name: "継続期", min: 100, max: 299 },
  { name: "熟達期", min: 300, max: 699 },
  { name: "達人期", min: 700, max: Infinity },
];

// 🏅 称号ステップ（単一ソース）
const TITLE_STEPS = [
  { min: 0, suffix: "・はじめの一歩" },
  { min: 10, suffix: "リズムメーカー" },
  { min: 30, suffix: "習慣家" },
  { min: 100, suffix: "名人" },
  { min: 300, suffix: "の匠" },
  { min: 700, suffix: "熟玄" },
  { min: 1000, suffix: "仙人" },
];

// 🏅 現在＆次の称号メタ情報
function getRankMeta(label, count) {
  const c = count || 0;
  let current = TITLE_STEPS[0];
  let next = null;

  for (let i = 0; i < TITLE_STEPS.length; i++) {
    const step = TITLE_STEPS[i];
    if (c >= step.min) {
      current = step;
      next = TITLE_STEPS[i + 1] || null;
    } else {
      next = step;
      break;
    }
  }

  return {
    currentTitle: `${label}${current.suffix}`,
    currentMin: current.min,
    nextTitle: next ? `${label}${next.suffix}` : null,
    nextMin: next ? next.min : null,
  };
}

// 🏅 称号生成（外部API互換用）
function getRankTitle(label, count) {
  return getRankMeta(label, count).currentTitle;
}

// 🎨 FlexボタンUI（優先／サポート分割・2列レイアウト）
function buildCareButtonsFlex({ adviceCards = [] } = {}) {
  const BUTTON_CONFIG = {
    habits:   { label: "体質改善習慣",         text: "体質改善習慣完了☑️" },
    breathing:{ label: "巡りととのう呼吸法",   text: "呼吸法完了☑️" },
    stretch:  { label: "経絡ストレッチ",       text: "ストレッチ完了☑️" },
    tsubo:    { label: "指先・ツボケア",       text: "ツボケア完了☑️" },
    kampo:    { label: "漢方・サプリ（任意）", text: "漢方・サプリ服用完了☑️" },
  };

  const adviceKeyToPillar = {
    breathing: "breathing",
    stretch: "stretch",
    points: "tsubo",
    lifestyle: "habits",
    kanpo: "kampo",
  };

  const priorityPillars = new Set();

  if (Array.isArray(adviceCards) && adviceCards.length > 0) {
    adviceCards.forEach((card) => {
      if (card.priority === 1 && card.key && adviceKeyToPillar[card.key]) {
        priorityPillars.add(adviceKeyToPillar[card.key]);
      }
    });
  }

  // 何も取れなかったときの最低限デフォルト
  if (priorityPillars.size === 0) {
    priorityPillars.add("breathing");
    priorityPillars.add("stretch");
  }

  const priorityButtons = [];
  const supportButtons = [];

  Object.entries(BUTTON_CONFIG).forEach(([pillarKey, cfg]) => {
    const bgColor = pillarKey === "kampo" ? "#DDDDDD" : "#7B9E76";

    // ← ここを「button」から「box + text（wrap）」に変更
    const btnBox = {
      type: "box",
      layout: "vertical",
      flex: 1,
      backgroundColor: bgColor,
      cornerRadius: "8px",
      paddingAll: "6px",
      alignItems: "center",
      justifyContent: "center",
      action: {
        type: "message",
        label: cfg.label,
        text: cfg.text,
      },
      contents: [
        {
          type: "text",
          text: cfg.label,
          size: "xs",
          color: "#ffffff",
          wrap: true,          // ★ これで2行折り返しOK
          align: "center",
        },
      ],
    };

    if (pillarKey === "kampo") {
      supportButtons.push(btnBox); // 漢方は常にサポート枠
    } else if (priorityPillars.has(pillarKey)) {
      priorityButtons.push(btnBox);
    } else {
      supportButtons.push(btnBox);
    }
  });

  // 2列レイアウト
  function buildTwoColumnRows(buttons) {
    const rows = [];
    for (let i = 0; i < buttons.length; i += 2) {
      const rowButtons = buttons.slice(i, i + 2);
      rows.push({
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        margin: "sm",
        contents: rowButtons,
      });
    }
    return rows;
  }

  const priorityContents =
    priorityButtons.length > 0
      ? [
          {
            type: "text",
            text: "＜優先ケア＞",
            size: "sm",
            weight: "bold",
            margin: "sm",
            wrap: true,
          },
          ...buildTwoColumnRows(priorityButtons),
        ]
      : [];

  const supportContents =
    supportButtons.length > 0
      ? [
          {
            type: "text",
            text: "＜サポートケア・おまけ＞",
            size: "sm",
            weight: "bold",
            margin: "md",
            wrap: true,
          },
          ...buildTwoColumnRows(supportButtons),
        ]
      : [];

  return {
    type: "flex",
    altText: "セルフケア実施記録",
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        paddingAll: "12px",
        backgroundColor: "#7B9E76",
        contents: [
          {
            type: "text",
            text: "🌿 実施したケアを記録",
            weight: "bold",
            size: "lg",
            color: "#ffffff",
            wrap: true,
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        paddingAll: "12px",
        contents: [
          {
            type: "text",
            text: "その日に行ったケアをタップすると、実施回数として記録されます。",
            size: "xs",
            color: "#555555",
            wrap: true,
          },
          ...priorityContents,
          ...supportContents,
        ],
      },
    },
  };
}

// 🌿 褒めメッセージ生成（称号保存付き／変更時のみお知らせ）
// 戻り値: { text: string, miniFlex: FlexMessageObject }
async function generatePraiseReply({ lineId, pillarKey, countsAll }) {
  const label = CARE_LABEL[pillarKey] || "ケア";
  const longLabel = CARE_LABEL_DISPLAY[pillarKey] || label;
  const tone = CARE_TONE[pillarKey] || "🌿";

  const count = countsAll[pillarKey] || 0;
  const total = Object.values(countsAll).reduce(
    (a, b) => a + (b || 0),
    0
  );

  const stage =
    STAGES.find((s) => count >= s.min && count <= s.max)?.name || "初期";

  const { currentTitle, currentMin, nextTitle, nextMin } = getRankMeta(
    label,
    count
  );
  const rank = currentTitle;

  // 進捗ゲージ（称号ステップ間の進み具合）
  let progressLabel = "";
  let progressGauge = "";

  if (nextTitle && nextMin != null) {
    const span = Math.max(1, nextMin - currentMin);
    const progressRaw = Math.max(0, Math.min(1, (count - currentMin) / span));

    let level = 1;
    if (progressRaw >= 0.9) level = 5;
    else if (progressRaw >= 0.7) level = 4;
    else if (progressRaw >= 0.5) level = 3;
    else if (progressRaw >= 0.2) level = 2;

    progressGauge = "■".repeat(level) + "□".repeat(5 - level);
    progressLabel = `次の称号「${nextTitle}」まで：あと ${
      nextMin - count
    }回`;
  } else {
    // 仙人まで到達済み
    progressGauge = "■■■■■";
    progressLabel = "称号は最高段階まで到達しています👏";
  }

  let message = "";

  // 🎯 節目コメント
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
      case 700:
        message = `${tone} ${label}700回！整いがすっかり自分の一部に🌸`;
        break;
      case 1000:
        message = `${tone} ${label}1000回！その姿勢、まさに本物の達人✨`;
        break;
    }
  } else {
    // 🌿 通常コメント（ステージ別）
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

  // ⚖️ バランス補足（そのケアに偏りすぎていたら）
  const ratio = total ? count / total : 0;
  if (ratio > 0.45 && ratio < 0.55 && total > 4) {
    message +=
      "\n\n🍃 他のケアも少し取り入れると、さらに整いやすいよ。";
  }

  // ※ここでもう累計・称号の数字は足さない（ミニフレックスに任せる）

  // 🏅 称号の変更検知＆保存
  try {
    const prevTitles = await getCareTitlesByLineId(lineId);
    const prevRank = prevTitles[pillarKey];

    if (prevRank !== rank) {
      await updateCareTitleByLineId(lineId, pillarKey, rank);
      message += `\n\n${tone} 今日からあなたは【${rank}】です！🏅`;
    } else {
      console.log(`[generatePraiseReply] Rank unchanged: ${rank}`);
    }
  } catch (err) {
    console.error("❌ updateCareTitleByLineId error:", err);
  }

  // 🎨 ミニフレックス（画面占有を抑えた状況ビュー）
  const miniFlex = {
    type: "flex",
    altText: `${longLabel}の実施状況`,
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "12px",
        contents: [
          {
            type: "text",
            text: `${tone} ${longLabel}`,
            weight: "bold",
            size: "md",
            wrap: true,
          },
          {
            type: "text",
            text: `累計：${count}回`,
            size: "sm",
            wrap: true,
          },
          {
            type: "text",
            text: `現在の称号：${rank}`,
            size: "sm",
            wrap: true,
          },
          {
            type: "text",
            text: progressLabel,
            size: "xs",
            color: "#555555",
            wrap: true,
          },
          {
            type: "text",
            text: `進み具合：［${progressGauge}］`,
            size: "xs",
            color: "#555555",
            wrap: true,
          },
        ],
      },
    },
  };

  return { text: message, miniFlex };
}

/** 🎲 ランダム選択 */
function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = { generatePraiseReply, buildCareButtonsFlex };
