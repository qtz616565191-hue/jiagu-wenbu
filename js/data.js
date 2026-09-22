// 《甲骨问卜》题库 —— 12 字（9 象形 + 3 会意/形声）
// 字形取自 glyphs.js（据汉典字源库真实刻辞实例，遴选见 字形遴选表-v1）

const QUESTIONS = [
  { char: '日', options: ['日', '月', '目', '白'], answer: '日',
    explain: '像太阳之形，外缘方折圆角，中一横为太阳的光。' },
  { char: '月', options: ['月', '夕', '肉', '日'], answer: '月',
    explain: '月以缺时常见，故像一弯新月，中含短画为月光，后世加笔以别"夕"。' },
  { char: '山', options: ['山', '丘', '火', '峰'], answer: '山',
    explain: '像群峰并起、中峰最高，下有横脉相连；两峰低矮者则为"丘"。' },
  { char: '水', options: ['水', '川', '河', '泉'], answer: '水',
    explain: '中间蜿蜒一竖为水脉主流，两侧点撇是飞溅的浪花。' },
  { char: '雨', options: ['雨', '雷', '雪', '云'], answer: '雨',
    explain: '上一横象天，下垂者为雨丝、间夹雨点，便是落雨之形。' },
  { char: '目', options: ['目', '耳', '眉', '日'], answer: '目',
    explain: '甲骨文"目"是一只横置的眼睛，眼眶加瞳仁；秦以后才竖起来写。' },
  { char: '家', options: ['家', '室', '牢', '宅'], answer: '家',
    explain: '上"宀"为屋舍，下"豕"为猪——有屋有畜，三千年前便是安居成家。' },
  { char: '马', options: ['马', '鹿', '虎', '驹'], answer: '马',
    explain: '马的侧写：昂首嘶鸣、鬃毛飞扬、四蹄腾跃，是甲骨上最有神的动物之一。' },
  { char: '鹿', options: ['鹿', '麋', '兔', '麟'], answer: '鹿',
    explain: '枝杈般的角、圆圆的大眼、修长的腿，堪称甲骨文里最优美的写生。' },
  { char: '休', options: ['休', '木', '体', '依'], answer: '休',
    explain: '人倚在大树之旁，便是歇息——把两个象形符号拼出新义的会意字。' },
  { char: '明', options: ['明', '晶', '朋', '照'], answer: '明',
    explain: '古多作"朙"：左"囧"像窗棂，右为月，月光透窗而入，会意明亮；后世或从日，写作"明"。' },
  { char: '河', options: ['河', '水', '江', '海'], answer: '河',
    explain: '甲骨文或借"何"（人荷担之形）为声，后加水旁；金文声符增口作"可"，小篆遂为从水、可声。本专指黄河，殷人亦以"河"为河神之名。' },
];

// 五阶段标签
const EVO_LABELS = ['商·甲骨', '周·金文', '秦·小篆', '汉·隶书', '今·楷书'];

// 隶书出处（每字遴选汉代真迹一件：汉碑拓本 / 马王堆西汉帛书）
const LISHU_SRC = {
  '日': '衡方碑', '月': '曹全碑', '山': '居延汉简', '水': '曹全碑',
  '雨': '曹全碑', '目': '马王堆帛书', '家': '马王堆帛书', '马': '曹全碑',
  '鹿': '袁博碑', '休': '马王堆帛书', '明': '马王堆帛书', '河': '马王堆帛书',
};

// 隶书类型：stele 东汉成熟八分碑刻；gu 西汉古隶（帛书/汉简，由篆入隶）
const LISHU_KIND = {
  '日': 'stele', '月': 'stele', '山': 'gu', '水': 'stele', '雨': 'stele',
  '目': 'gu', '家': 'gu', '马': 'stele', '鹿': 'stele',
  '休': 'gu', '明': 'gu', '河': 'gu',
};

// 字形装配：甲骨/金文/小篆/隶书皆为真实器物实例（SVG 拓本 / 汉隶 GIF 拓本）；
// 仅楷书用现代字体排印（古今对照的"今"）
QUESTIONS.forEach(q => {
  q.glyph = GLYPHS_JIAGU[q.char];
  q.evolution = [
    { type: 'svg', html: GLYPHS_JIAGU[q.char] },
    { type: 'svg', html: GLYPHS_JINWEN[q.char] },
    { type: 'svg', html: GLYPHS_XIAOZHUAN[q.char] },
    { type: 'lishu', src: 'img/lishu/' + q.char + '.png', src2: LISHU_SRC[q.char], kind: LISHU_KIND[q.char] },
    { type: 'text', text: q.char, cls: 'kai' },  // 楷书
  ];
});

// 五阶段一句话说明
const EVO_NOTES = [
  '商·甲骨：刀刻于龟甲兽骨，字取物象，笔画方折天真。',
  '周·金文：范铸于青铜礼器，线条浑厚，趋于圆转规整。',
  '秦·小篆：书同文，线条匀净对称，字形修长定型。',
  '汉·隶书：方折波磔，字形趋扁，古今文字的分水岭。',
  '今·楷书：方正平直，笔画完备，沿用至今。',
];

// 卜辞评级（按首次答对率）
function grade(score, total) {
  const r = score / total;
  if (r >= 0.9) return { title: '大吉', text: '汝与三千年前之刻辞，心有灵犀。' };
  if (r >= 0.65) return { title: '吉', text: '已窥门径，再寻可通三千年。' };
  if (r >= 0.35) return { title: '小吉', text: '龟甲半启，甲骨之奥尚待细寻。' };
  return { title: '待问', text: '寻踪之路方始，来日正长。' };
}
