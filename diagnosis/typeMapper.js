console.log("🧠 typeMapper.js is ALIVE");

const typeMapper = {};

// 体質タイプのマッピング配列
[
  [-1, -1, -1, "陽虚・気虚タイプ"],
  [-1, -1,  0, "陽虚傾向タイプ"],
  [-1, -1,  1, "陽虚・血虚タイプ"],
  [-1,  0, -1, "陽虚傾向タイプ"],
  [-1,  0,  0, "陽虚タイプ"],
  [-1,  0,  1, "陽虚・血虚タイプ"],
  [-1,  1, -1, "陽虚・気虚タイプ"],
  [-1,  1,  0, "陽虚傾向タイプ"],
  [-1,  1,  1, "陽虚・血虚タイプ"],
  [ 0, -1, -1, "気虚タイプ"],
  [ 0, -1,  0, "気虚傾向タイプ"],
  [ 0, -1,  1, "気虚・血虚タイプ"],
  [ 0,  0, -1, "気虚傾向タイプ"],
  [ 0,  0,  0, "平性（偏りなし）"],
  [ 0,  0,  1, "血虚傾向タイプ"],
  [ 0,  1, -1, "気虚・血虚タイプ"],
  [ 0,  1,  0, "血虚傾向タイプ"],
  [ 0,  1,  1, "血虚タイプ"],
  [ 1, -1, -1, "実証・気虚タイプ"],
  [ 1, -1,  0, "実証傾向タイプ"],
  [ 1, -1,  1, "実証・血虚タイプ"],
  [ 1,  0, -1, "実証傾向タイプ"],
  [ 1,  0,  0, "実証タイプ"],
  [ 1,  0,  1, "実証・血虚タイプ"],
  [ 1,  1, -1, "実証・気虚タイプ"],
  [ 1,  1,  0, "実証傾向タイプ"],
  [ 1,  1,  1, "実証・血虚タイプ"],
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
