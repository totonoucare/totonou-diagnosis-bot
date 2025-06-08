console.log("🧠 typeMapper.js is ALIVE");

const typeMapper = {};

// 体質タイプのマッピング配列
[
  [-1, -1, -1, "虚寒・気血両虚タイプ"],
  [-1, -1,  0, "陽虚傾向タイプ"],
  [-1, -1,  1, "陽虚（本格型）タイプ"],
  [-1,  0, -1, "血虚タイプ"],
  [-1,  0,  0, "単純気虚タイプ"],
  [-1,  0,  1, "気血両虚タイプ"],
  [-1,  1, -1, "陰虚（虚熱）タイプ"],
  [-1,  1,  0, "鬱熱（繊細型）タイプ"],
  [-1,  1,  1, "鬱熱（繊細型）タイプ"],
  [ 0, -1, -1, "寒・瘀血タイプ"],
  [ 0, -1,  0, "単純寒証タイプ"],
  [ 0, -1,  1, "陽虚傾向タイプ"],
  [ 0,  0, -1, "血虚傾向タイプ"],
  [ 0,  0,  0, "平性（偏りなし）"],
  [ 0,  0,  1, "気虚タイプ"],
  [ 0,  1, -1, "陰虚タイプ（代謝高め）"],
  [ 0,  1,  0, "気滞熱タイプ"],
  [ 0,  1,  1, "鬱熱タイプ"],
  [ 1, -1, -1, "実寒・瘀血タイプ"],
  [ 1, -1,  0, "実寒（外因性）タイプ"],
  [ 1, -1,  1, "実寒・水滞タイプ"],
  [ 1,  0, -1, "血虚（過活動型）タイプ"],
  [ 1,  0,  0, "体力充実タイプ"],
  [ 1,  0,  1, "気虚（過活動型）タイプ"],
  [ 1,  1, -1, "陰虚火旺タイプ"],
  [ 1,  1,  0, "実熱タイプ"],
  [ 1,  1,  1, "鬱熱（過活動型）タイプ"],
].forEach(([a, b, c, label]) => {
  const key = `${a},${b},${c}`;
  typeMapper[key] = label;

  // 🔎 Unicodeチェックログ出力
  console.log(`🔍 生成キー: ${key}`);
  for (let i = 0; i < key.length; i++) {
    const ch = key[i];
    const code = ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0");
    console.log(`  🔍 文字: "${ch}" / index ${i} / Unicode: U+${code}`);
  }
});

// 🔁 タイプ名取得関数
function getTypeName(score1, score2, score3) {
  const key = `${score1},${score2},${score3}`;
  console.log("🔎 getTypeName called with:", score1, score2, score3);
  console.log("🔑 生成されたキー:", key);
  console.log("📦 マッピング済みキー一覧:", Object.keys(typeMapper));

  const result = typeMapper[key];
  if (!result) {
    console.warn("❌ 該当なし: ", key);
  } else {
    console.log("✅ マッチした体質タイプ:", result);
  }

  return result;
}

module.exports = getTypeName;
