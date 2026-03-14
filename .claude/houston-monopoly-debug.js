
// ============================================================
// 休士頓大富翁 - H-Town Edition
// 完整遊戲邏輯
// ============================================================

// ===== 音效系統（Web Audio API）=====
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;
function initAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
}
function playSound(type) {
  initAudio();
  const ctx = audioCtx;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.value = 0.15;
  switch(type) {
    case 'roll': // 擲骰聲
      osc.type = 'triangle'; osc.frequency.value = 165;
      osc.frequency.setValueAtTime(165, now);
      osc.frequency.exponentialRampToValueAtTime(102, now + 0.06);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.038, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.start(now); osc.stop(now + 0.08);

      setTimeout(() => {
        const o2 = ctx.createOscillator(), g2 = ctx.createGain();
        o2.connect(g2); g2.connect(ctx.destination);
        o2.type = 'triangle';
        o2.frequency.setValueAtTime(138, ctx.currentTime);
        o2.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.05);
        g2.gain.setValueAtTime(0.001, ctx.currentTime);
        g2.gain.linearRampToValueAtTime(0.026, ctx.currentTime + 0.006);
        g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
        o2.start();
        o2.stop(ctx.currentTime + 0.07);
      }, 45);
      break;
    case 'buy': // 買地叮
      osc.type = 'sine'; osc.frequency.value = 523;
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.4);
      osc.start(now); osc.stop(now + 0.4);
      setTimeout(() => {
        const o2 = ctx.createOscillator(), g2 = ctx.createGain();
        o2.connect(g2); g2.connect(ctx.destination);
        o2.type = 'sine'; o2.frequency.value = 659;
        g2.gain.value = 0.2;
        g2.gain.setValueAtTime(0.2, ctx.currentTime);
        g2.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        o2.start(); o2.stop(ctx.currentTime + 0.3);
      }, 150);
      break;
    case 'bankrupt': // 破產嗚
      osc.type = 'sawtooth'; osc.frequency.value = 400;
      osc.frequency.linearRampToValueAtTime(100, now + 0.8);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0, now + 1);
      osc.start(now); osc.stop(now + 1);
      break;
    case 'collect': // 收錢聲
      osc.type = 'sine'; osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.15);
      osc.start(now); osc.stop(now + 0.15);
      break;
    case 'jail': // 進監獄
      osc.type = 'square'; osc.frequency.value = 150;
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.5);
      osc.start(now); osc.stop(now + 0.5);
      break;
    case 'win': // 勝利
      [523,659,784,1047].forEach((f,i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.15, now + i*0.2);
        g.gain.linearRampToValueAtTime(0, now + i*0.2 + 0.3);
        o.start(now + i*0.2); o.stop(now + i*0.2 + 0.4);
      });
      break;
  }
}

// ===== 棋盤定義：40 格 =====
const TOKENS = ['🚀','🤠','👨‍🚀','🛸','⭐','🐂'];
const TOKEN_NAMES = ['火箭','牛仔帽','太空人','飛碟','星星','長角牛'];
const HOUSTON_PLAYER_NAMES = ['Astro', 'Bayou', 'Rodeo', 'Skyline', 'Tex', 'Comet'];
const PLAYER_COLORS = ['#FF6B6B', '#4ECDC4', '#FFD166', '#8E7DF2', '#5CC8FF', '#95E06C'];
const COLOR_HEX = {
  brown: '#C8A2FF', lightblue: '#87CEEB', pink: '#FF69B4',
  orange: '#FF8C00', red: '#FF0000', yellow: '#FFD700',
  green: '#228B22', darkblue: '#00008B'
};
const COLOR_NAME_I18N = {
  brown: { zh: '紫棕', en: 'Lavender' },
  lightblue: { zh: '淺藍', en: 'Light Blue' },
  pink: { zh: '粉紅', en: 'Pink' },
  orange: { zh: '橘色', en: 'Orange' },
  red: { zh: '紅色', en: 'Red' },
  yellow: { zh: '黃色', en: 'Yellow' },
  green: { zh: '綠色', en: 'Green' },
  darkblue: { zh: '深藍', en: 'Dark Blue' }
};

// 棋盤格子定義
const SPACES = [
  // 0: GO
  { name: 'GO', type: 'go', desc: 'Welcome to H-Town！領 $200' },
  // 1-2: Brown
  { name: 'The Heights', type: 'property', color: 'brown', price: 60, rent: [2,10,30,90,160,250], buildCost: 50 },
  { name: 'Community Chest', type: 'community', desc: 'Community Chest' },
  { name: 'Montrose', type: 'property', color: 'brown', price: 60, rent: [4,20,60,180,320,450], buildCost: 50 },
  { name: 'Income Tax', type: 'tax', amount: 200, desc: 'Pay $200 income tax' },
  // 5: Railroad
  { name: 'METRO Red Line', type: 'railroad', price: 200 },
  // 6-8-9: Light Blue
  { name: 'Rice Village', type: 'property', color: 'lightblue', price: 100, rent: [6,30,90,270,400,550], buildCost: 50 },
  { name: 'Chance', type: 'chance', desc: 'Chance' },
  { name: 'Discovery Green', type: 'property', color: 'lightblue', price: 100, rent: [6,30,90,270,400,550], buildCost: 50 },
  { name: 'Buffalo Bayou', type: 'property', color: 'lightblue', price: 120, rent: [8,40,100,300,450,600], buildCost: 50 },
  // 10: Jail
  { name: 'Jail', type: 'jail', desc: 'Just Visiting / In Jail' },
  // 11-13-14: Pink
  { name: 'Midtown', type: 'property', color: 'pink', price: 140, rent: [10,50,150,450,625,750], buildCost: 100 },
  { name: 'Houston Electricity', type: 'utility', price: 150, desc: '⚡ 休士頓電力（油氣）' },
  { name: 'EaDo', type: 'property', color: 'pink', price: 140, rent: [10,50,150,450,625,750], buildCost: 100 },
  { name: 'Third Ward', type: 'property', color: 'pink', price: 160, rent: [12,60,180,500,700,900], buildCost: 100 },
  // 15: Railroad
  { name: 'Bush Airport', type: 'railroad', price: 200 },
  // 16-18-19: Orange
  { name: 'Galleria', type: 'property', color: 'orange', price: 180, rent: [14,70,200,550,750,950], buildCost: 100 },
  { name: 'Community Chest', type: 'community', desc: 'Community Chest' },
  { name: 'River Oaks', type: 'property', color: 'orange', price: 180, rent: [14,70,200,550,750,950], buildCost: 100 },
  { name: 'Memorial Park', type: 'property', color: 'orange', price: 200, rent: [16,80,220,600,800,1000], buildCost: 100 },
  // 20: Free Parking
  { name: 'Free Parking', type: 'free', desc: 'Take a break!' },
  // 21-23-24: Red
  { name: 'Minute Maid Park', type: 'property', color: 'red', price: 220, rent: [18,90,250,700,875,1050], buildCost: 150 },
  { name: 'Chance', type: 'chance', desc: 'Chance' },
  { name: 'NRG Stadium', type: 'property', color: 'red', price: 220, rent: [18,90,250,700,875,1050], buildCost: 150 },
  { name: 'Toyota Center', type: 'property', color: 'red', price: 240, rent: [20,100,300,750,925,1100], buildCost: 150 },
  // 25: Railroad
  { name: 'Hobby Airport', type: 'railroad', price: 200 },
  // 26-28-29: Yellow
  { name: 'Houston Zoo', type: 'property', color: 'yellow', price: 260, rent: [22,110,330,800,975,1150], buildCost: 150 },
  { name: 'Hermann Park', type: 'property', color: 'yellow', price: 260, rent: [22,110,330,800,975,1150], buildCost: 150 },
  { name: 'Houston Water', type: 'utility', price: 150, desc: '💧 休士頓自來水' },
  { name: 'Museum District', type: 'property', color: 'yellow', price: 280, rent: [24,120,360,850,1025,1200], buildCost: 150 },
  // 30: Go to Jail
  { name: 'Go to Jail', type: 'gotojail', desc: 'Go directly to jail!' },
  // 31-33-34: Green
  { name: 'Tanglewood', type: 'property', color: 'green', price: 300, rent: [26,130,390,900,1100,1275], buildCost: 200 },
  { name: 'West University', type: 'property', color: 'green', price: 300, rent: [26,130,390,900,1100,1275], buildCost: 200 },
  { name: 'Community Chest', type: 'community', desc: 'Community Chest' },
  { name: 'Upper Kirby', type: 'property', color: 'green', price: 320, rent: [28,150,450,1000,1200,1400], buildCost: 200 },
  // 35: Railroad
  { name: 'Port of Houston', type: 'railroad', price: 200 },
  // 36-37-39: Dark Blue
  { name: 'Chance', type: 'chance', desc: 'Chance' },
  { name: 'Space Center', type: 'property', color: 'darkblue', price: 350, rent: [35,175,500,1100,1300,1500], buildCost: 200 },
  { name: 'Luxury Tax', type: 'tax', amount: 100, desc: 'Pay $100 luxury tax' },
  { name: 'NASA JSC', type: 'property', color: 'darkblue', price: 400, rent: [50,200,600,1400,1700,2000], buildCost: 200 },
];

// ===== Chance 卡 =====
const CHANCE_CARDS = [
  { text: '🚗 I-10 大塞車！付 $200 修車費', action: 'pay', amount: 200 },
  { text: '⚾ Astros 贏世界大賽！每位玩家給你 $50', action: 'collect_all', amount: 50 },
  { text: '🚀 去 NASA 參觀！移動到 NASA JSC', action: 'moveto', dest: 39 },
  { text: '🏠 房屋維修：每棟房 $25，每座旅館 $100', action: 'repair', house: 25, hotel: 100 },
  { text: '🎓 Rice University 獎學金！領 $150', action: 'receive', amount: 150 },
  { text: '🌪️ 颶風來襲！付 $300 修理費', action: 'pay', amount: 300 },
  { text: '💰 石油大發現！領 $200', action: 'receive', amount: 200 },
  { text: '🏈 Texans 季後賽門票收入 $100', action: 'receive', amount: 100 },
  { text: '👮 超速被抓！進監獄', action: 'gotojail' },
  { text: '🎰 Galveston 賭船贏錢！領 $50', action: 'receive', amount: 50 },
  { text: '🛤️ 搭 METRO 去最近的車站', action: 'nearest_railroad' },
  { text: '📦 前進到 GO，領 $200', action: 'moveto', dest: 0 },
  { text: '🏗️ 移動到 Galleria 購物', action: 'moveto', dest: 16 },
  { text: '⬅️ 後退 3 格', action: 'back', steps: 3 },
  { text: '🤑 銀行股息！領 $50', action: 'receive', amount: 50 },
  { text: '🌮 Taco Truck 創業成功！領 $100', action: 'receive', amount: 100 },
  { text: '🏥 醫療帳單：付 $100', action: 'pay', amount: 100 },
  { text: '🎵 Rodeo 演唱會門票！領 $75', action: 'receive', amount: 75 },
  { text: '🚧 道路施工罰款：付 $150', action: 'pay', amount: 150 },
  { text: '🆓 出獄自由卡！保留備用', action: 'jail_free' },
];

// ===== Community Chest 卡 =====
const COMMUNITY_CARDS = [
  { text: '🏦 銀行出錯，收 $200', action: 'receive', amount: 200 },
  { text: '💊 醫藥費：付 $50', action: 'pay', amount: 50 },
  { text: '📈 股票獲利：收 $45', action: 'receive', amount: 45 },
  { text: '🎂 生日快樂！每位玩家給你 $10', action: 'collect_all', amount: 10 },
  { text: '🏥 住院費：付 $100', action: 'pay', amount: 100 },
  { text: '📚 退稅：收 $20', action: 'receive', amount: 20 },
  { text: '🏠 房屋維修：每棟房 $40，每座旅館 $115', action: 'repair', house: 40, hotel: 115 },
  { text: '💼 顧問費收入：收 $25', action: 'receive', amount: 25 },
  { text: '🎭 選美比賽獎金：收 $10', action: 'receive', amount: 10 },
  { text: '💰 遺產繼承：收 $100', action: 'receive', amount: 100 },
  { text: '📦 前進到 GO，領 $200', action: 'moveto', dest: 0 },
  { text: '👮 進監獄！不經過 GO', action: 'gotojail' },
  { text: '🆓 出獄自由卡！保留備用', action: 'jail_free' },
  { text: '🛢️ 德州石油分紅：收 $150', action: 'receive', amount: 150 },
  { text: '🌊 洪水保險賠償：收 $80', action: 'receive', amount: 80 },
  { text: '🍖 BBQ 比賽獎金：收 $60', action: 'receive', amount: 60 },
  { text: '📱 手機帳單：付 $75', action: 'pay', amount: 75 },
  { text: '🎓 學費：付 $150', action: 'pay', amount: 150 },
  { text: '🤝 慈善捐款：付 $50', action: 'pay', amount: 50 },
  { text: '🏆 Rodeo 冠軍獎金：收 $200', action: 'receive', amount: 200 },
];

const SPACE_I18N = {
  0: { zh: { name: 'GO', desc: '歡迎來到休士頓！領 $200' }, en: { name: 'GO', desc: 'Welcome to Houston! Collect $200' } },
  1: { zh: { name: '高地區' }, en: { name: 'The Heights' } },
  2: { zh: { name: '公共基金', desc: '公共基金' }, en: { name: 'Community Chest', desc: 'Community Chest' } },
  3: { zh: { name: '蒙特羅斯' }, en: { name: 'Montrose' } },
  4: { zh: { name: '所得稅', desc: '繳 $200 所得稅' }, en: { name: 'Income Tax', desc: 'Pay $200 income tax' } },
  5: { zh: { name: 'METRO 紅線' }, en: { name: 'METRO Red Line' } },
  6: { zh: { name: '萊斯村' }, en: { name: 'Rice Village' } },
  7: { zh: { name: '機會', desc: '機會' }, en: { name: 'Chance', desc: 'Chance' } },
  8: { zh: { name: '探索綠地' }, en: { name: 'Discovery Green' } },
  9: { zh: { name: '水牛河灣' }, en: { name: 'Buffalo Bayou' } },
  10: { zh: { name: '監獄', desc: '只是路過 / 坐牢' }, en: { name: 'Jail', desc: 'Just Visiting / In Jail' } },
  11: { zh: { name: '中城' }, en: { name: 'Midtown' } },
  12: { zh: { name: '休士頓電力', desc: '休士頓電力設施' }, en: { name: 'Houston Electricity', desc: 'Houston power utility' } },
  13: { zh: { name: 'EaDo 東區市中心' }, en: { name: 'EaDo' } },
  14: { zh: { name: '第三區' }, en: { name: 'Third Ward' } },
  15: { zh: { name: '布希機場' }, en: { name: 'Bush Airport' } },
  16: { zh: { name: '蓋樂麗雅' }, en: { name: 'Galleria' } },
  17: { zh: { name: '公共基金', desc: '公共基金' }, en: { name: 'Community Chest', desc: 'Community Chest' } },
  18: { zh: { name: '河橡區' }, en: { name: 'River Oaks' } },
  19: { zh: { name: '紀念公園' }, en: { name: 'Memorial Park' } },
  20: { zh: { name: '免費停車', desc: '休息一下！' }, en: { name: 'Free Parking', desc: 'Take a breather!' } },
  21: { zh: { name: '太空人球場' }, en: { name: 'Minute Maid Park' } },
  22: { zh: { name: '機會', desc: '機會' }, en: { name: 'Chance', desc: 'Chance' } },
  23: { zh: { name: 'NRG 體育場' }, en: { name: 'NRG Stadium' } },
  24: { zh: { name: '豐田中心' }, en: { name: 'Toyota Center' } },
  25: { zh: { name: '霍比機場' }, en: { name: 'Hobby Airport' } },
  26: { zh: { name: '休士頓動物園' }, en: { name: 'Houston Zoo' } },
  27: { zh: { name: '赫曼公園' }, en: { name: 'Hermann Park' } },
  28: { zh: { name: '休士頓自來水', desc: '休士頓水務設施' }, en: { name: 'Houston Water', desc: 'Houston water utility' } },
  29: { zh: { name: '博物館區' }, en: { name: 'Museum District' } },
  30: { zh: { name: '進監獄', desc: '直接進監獄！' }, en: { name: 'Go to Jail', desc: 'Go directly to jail!' } },
  31: { zh: { name: '坦格伍德' }, en: { name: 'Tanglewood' } },
  32: { zh: { name: '西大學區' }, en: { name: 'West University' } },
  33: { zh: { name: '公共基金', desc: '公共基金' }, en: { name: 'Community Chest', desc: 'Community Chest' } },
  34: { zh: { name: '上柯比區' }, en: { name: 'Upper Kirby' } },
  35: { zh: { name: '休士頓港' }, en: { name: 'Port of Houston' } },
  36: { zh: { name: '機會', desc: '機會' }, en: { name: 'Chance', desc: 'Chance' } },
  37: { zh: { name: '太空中心' }, en: { name: 'Space Center' } },
  38: { zh: { name: '奢侈稅', desc: '繳 $100 奢侈稅' }, en: { name: 'Luxury Tax', desc: 'Pay $100 luxury tax' } },
  39: { zh: { name: 'NASA 詹森中心' }, en: { name: 'NASA JSC' } }
};

const CHANCE_CARD_TEXT = {
  zh: CHANCE_CARDS.map(card => card.text),
  en: [
    '🚗 Traffic jam on I-10! Pay $200 for repairs',
    '⚾ Astros win the World Series! Each player pays you $50',
    '🚀 Tour NASA! Move to NASA JSC',
    '🏠 Property repairs: Pay $25 per house and $100 per hotel',
    '🎓 Rice University scholarship! Collect $150',
    '🌪️ Hurricane damage! Pay $300 in repairs',
    '💰 Oil strike! Collect $200',
    '🏈 Texans playoff ticket revenue: Collect $100',
    '👮 Caught speeding! Go to jail',
    '🎰 Win in Galveston! Collect $50',
    '🛤️ Take METRO to the nearest station',
    '📦 Advance to GO and collect $200',
    '🏙️ Move to the Galleria',
    '⬅️ Go back 3 spaces',
    '🤑 Bank dividend! Collect $50',
    '🌮 Taco truck success! Collect $100',
    '🏥 Medical bill: Pay $100',
    '🎵 Rodeo concert tickets! Collect $75',
    '🚧 Road work fine: Pay $150',
    '🆓 Get Out of Jail Free card. Keep it'
  ]
};

const COMMUNITY_CARD_TEXT = {
  zh: COMMUNITY_CARDS.map(card => card.text),
  en: [
    '🏦 Bank error in your favor. Collect $200',
    '💊 Pharmacy bill: Pay $50',
    '📈 Stock profit: Collect $45',
    '🎂 Birthday! Each player gives you $10',
    '🏥 Hospital stay: Pay $100',
    '📚 Tax refund: Collect $20',
    '🏠 Property repairs: Pay $40 per house and $115 per hotel',
    '💼 Consulting fee income: Collect $25',
    '🎭 Beauty pageant prize: Collect $10',
    '💰 Inheritance: Collect $100',
    '📦 Advance to GO and collect $200',
    '👮 Go to jail. Do not pass GO',
    '🆓 Get Out of Jail Free card. Keep it',
    '🛢️ Texas oil dividend: Collect $150',
    '🌊 Flood insurance payout: Collect $80',
    '🍖 BBQ contest prize: Collect $60',
    '📱 Phone bill: Pay $75',
    '🎓 Tuition: Pay $150',
    '🤝 Charity donation: Pay $50',
    '🏆 Rodeo champion bonus: Collect $200'
  ]
};

// ===== 遊戲狀態 =====
let game = {
  players: [],
  currentPlayer: 0,
  phase: 'setup', // setup, rolling, rolled, action, turnend, gameover
  doublesCount: 0,
  chanceIdx: 0,
  communityIdx: 0,
  chanceDeck: [],
  communityDeck: [],
};

const I18N = {
  zh: {
    langToggle: 'EN',
    setupTitle: '休士頓大富翁',
    setupSubtitle: 'H-TOWN EDITION',
    setupHeading: '🤠 遊戲設定',
    playerCountLabel: '玩家人數',
    playersSuffix: '人',
    startGame: '🏙️ 開始遊戲！Let\'s Go H-Town!',
    backHome: '🏠 回到首頁',
    gameTitle: '休士頓大富翁',
    rules: '📖 規則',
    restart: '🔄 重新開始',
    exit: '🚪 離開遊戲',
    roll: '🎲 擲骰子',
    buy: '🏠 購買地產',
    build: '🛢️ 蓋房子',
    mortgage: '🏦 抵押管理',
    endTurn: '⏭️ 結束回合',
    payJail: '💰 付 $50 出獄',
    useJailCard: '🆓 使用出獄卡',
    rollJail: '🎲 擲骰求雙',
    gameLog: '📋 遊戲記錄',
    human: '👤 人類',
    ai: '🤖 電腦',
    turn: '的回合',
    rulesTitle: '📖 遊戲規則',
    rulesBody: [
      '🎲 擲骰：擲兩個骰子，移動相應步數',
      '🎯 雙數：擲出雙數可再擲一次，連三次進監獄',
      '🏠 買地：停在無主地產上可購買',
      '💰 租金：停在他人地產需付租金',
      '🛢️ 建築：壟斷同色地產後可蓋房子，最多 4 棟',
      '🚀 旅館：4 棟房子可升級為太空艙旅館',
      '🏦 抵押：缺錢可抵押地產（半價），付 55% 解除',
      '🔒 監獄：付 $50、用出獄卡、或擲雙數出獄',
      '🏙️ GO：經過或停在 GO 領 $200',
      '🏆 勝利：所有人類玩家破產時遊戲結束'
    ],
    ok: '了解！',
    confirmRestartTitle: '🔄 重新開始？',
    confirmRestartBody: '目前這一局的進度不會保留，確定要重新開始嗎？',
    cancel: '取消',
    confirmExitTitle: '🚪 離開遊戲？',
    confirmExitBody: '你會回到遊戲列表頁，這一局未保存的進度會消失。',
    keepPlaying: '繼續遊玩',
    victoryTitle: '🏆 遊戲結束！',
    victoryChampion: '休士頓冠軍！H-Town Champion！',
    gameEnded: '本局已結束',
    finalAssets: '最終資產',
    properties: '地產',
    noWinner: '無人存活',
    allOut: '所有玩家皆已出局',
    playAgain: '🔄 再玩一次'
  },
  en: {
    langToggle: '中文',
    setupTitle: 'Houstonopoly',
    setupSubtitle: 'H-TOWN EDITION',
    setupHeading: '🤠 Game Setup',
    playerCountLabel: 'Number of Players',
    playersSuffix: ' Players',
    startGame: '🏙️ Start Game! Let\'s Go H-Town!',
    backHome: '🏠 Back to Home',
    gameTitle: 'Houstonopoly',
    rules: '📖 Rules',
    restart: '🔄 Restart',
    exit: '🚪 Exit Game',
    roll: '🎲 Roll Dice',
    buy: '🏠 Buy Property',
    build: '🛢️ Build',
    mortgage: '🏦 Mortgage',
    endTurn: '⏭️ End Turn',
    payJail: '💰 Pay $50 to Leave Jail',
    useJailCard: '🆓 Use Get Out of Jail Card',
    rollJail: '🎲 Roll for Doubles',
    gameLog: '📋 Game Log',
    human: '👤 Human',
    ai: '🤖 AI',
    turn: '\'s turn',
    rulesTitle: '📖 How to Play',
    rulesBody: [
      '🎲 Roll two dice and move that many spaces',
      '🎯 Doubles let you roll again, but three in a row sends you to jail',
      '🏠 Buy unowned property when you land on it',
      '💰 Pay rent when you land on another player\'s property',
      '🛢️ Build houses after completing a color set, up to 4 houses',
      '🚀 Upgrade 4 houses into a space-hotel',
      '🏦 Mortgage property for cash, pay 55% to lift it',
      '🔒 Leave jail by paying $50, using a card, or rolling doubles',
      '🏙️ Collect $200 when you pass or land on GO',
      '🏆 The game ends when all human players are bankrupt'
    ],
    ok: 'Got it',
    confirmRestartTitle: '🔄 Restart Game?',
    confirmRestartBody: 'Current progress will be lost. Restart this match?',
    cancel: 'Cancel',
    confirmExitTitle: '🚪 Exit Game?',
    confirmExitBody: 'You will return to the game list and lose any unsaved progress.',
    keepPlaying: 'Keep Playing',
    victoryTitle: '🏆 Game Over!',
    victoryChampion: 'Houston Champion! H-Town Champion!',
    gameEnded: 'This match has ended',
    finalAssets: 'Final Assets',
    properties: 'Properties',
    noWinner: 'No Winner',
    allOut: 'All players are out',
    playAgain: '🔄 Play Again'
  }
};

let currentLang = localStorage.getItem('houstonopoly-lang') === 'en' ? 'en' : 'zh';

function t(key) {
  return I18N[currentLang][key];
}

function tr(zh, en) {
  return currentLang === 'zh' ? zh : en;
}

function getSpaceName(idx) {
  return SPACE_I18N[idx]?.[currentLang]?.name || SPACES[idx].name;
}

function getBoardSpaceName(idx) {
  return SPACES[idx].name;
}

function getSpaceDesc(idx) {
  return SPACE_I18N[idx]?.[currentLang]?.desc || SPACES[idx].desc || '';
}

function getCardText(type, idx) {
  return (type === 'chance' ? CHANCE_CARD_TEXT : COMMUNITY_CARD_TEXT)[currentLang][idx];
}

function applyLanguage() {
  document.documentElement.lang = currentLang === 'zh' ? 'zh-TW' : 'en';
  document.title = currentLang === 'zh' ? '休士頓大富翁 - H-Town Edition' : 'Houstonopoly - H-Town Edition';
  document.getElementById('lang-toggle-setup').textContent = t('langToggle');
  document.getElementById('lang-toggle-game').textContent = t('langToggle');
  document.getElementById('setup-title').textContent = t('setupTitle');
  document.getElementById('setup-subtitle').textContent = t('setupSubtitle');
  document.getElementById('setup-heading').textContent = t('setupHeading');
  document.getElementById('player-count-label').textContent = t('playerCountLabel');
  document.getElementById('start-game-btn').textContent = t('startGame');
  document.getElementById('back-home-btn').textContent = t('backHome');
  document.getElementById('game-title').textContent = t('gameTitle');
  document.getElementById('rules-btn').textContent = t('rules');
  document.getElementById('restart-btn').textContent = t('restart');
  document.getElementById('exit-btn').textContent = t('exit');
  document.getElementById('game-log-title').textContent = t('gameLog');
  document.getElementById('roll-btn').textContent = t('roll');
  document.getElementById('btn-buy').textContent = t('buy');
  document.getElementById('btn-build').textContent = t('build');
  document.getElementById('btn-mortgage').textContent = t('mortgage');
  document.getElementById('btn-end-turn').textContent = t('endTurn');
  document.getElementById('btn-pay-jail').textContent = t('payJail');
  document.getElementById('btn-roll-jail').textContent = t('rollJail');

  const countSelect = document.getElementById('player-count');
  Array.from(countSelect.options).forEach(option => {
    option.textContent = currentLang === 'zh' ? `${option.value} 人` : `${option.value} Players`;
  });

  renderPlayerSetup();
  if (game.players.length > 0) updateButtons();
  if (game.players.length > 0) renderAll();
  localStorage.setItem('houstonopoly-lang', currentLang);
}

// ===== 初始化設定畫面 =====
function initSetup() {
  const countSel = document.getElementById('player-count');
  countSel.addEventListener('change', renderPlayerSetup);
  renderPlayerSetup();
}

function renderPlayerSetup() {
  const count = parseInt(document.getElementById('player-count').value);
  const list = document.getElementById('player-setup-list');
  list.innerHTML = '';
  for (let i = 0; i < count; i++) {
    list.innerHTML += `
      <div class="flex items-center gap-2 bg-gray-800/50 rounded-lg p-2">
        <span class="text-xl">${TOKENS[i]}</span>
        <input type="text" id="pname-${i}" value="${HOUSTON_PLAYER_NAMES[i] || `Player ${i+1}`}"
          class="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white" />
        <select id="ptype-${i}" class="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white">
          <option value="human">${t('human')}</option>
          <option value="ai">${t('ai')}</option>
        </select>
      </div>
    `;
  }
}

// ===== 開始遊戲 =====
function startGame() {
  initAudio();
  const count = parseInt(document.getElementById('player-count').value);
  game.players = [];
  for (let i = 0; i < count; i++) {
    game.players.push({
      id: i,
      name: document.getElementById(`pname-${i}`).value || HOUSTON_PLAYER_NAMES[i] || `Player ${i+1}`,
      token: TOKENS[i],
      tokenName: TOKEN_NAMES[i],
      isAI: document.getElementById(`ptype-${i}`).value === 'ai',
      money: 1500,
      position: 0,
      properties: [],
      inJail: false,
      jailTurns: 0,
      jailFreeCards: 0,
      bankrupt: false,
    });
  }
  // 洗牌
  game.chanceDeck = shuffle([...Array(CHANCE_CARDS.length).keys()]);
  game.communityDeck = shuffle([...Array(COMMUNITY_CARDS.length).keys()]);
  game.chanceIdx = 0;
  game.communityIdx = 0;
  game.currentPlayer = 0;
  game.phase = 'rolling';
  game.doublesCount = 0;

  document.getElementById('setup-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');

  buildBoard();
  renderAll();
  logMsg(tr('🏙️ 遊戲開始！歡迎來到 H-Town！', '🏙️ Game started! Welcome to H-Town!'));
  startTurn();
}

// ===== 棋盤渲染 =====
function buildBoard() {
  const grid = document.getElementById('board-grid');
  grid.innerHTML = '';

  // 計算格子在 grid 中的位置
  const cellPositions = [];
  // 底部行：位置 0-10，col 11 到 col 1
  for (let i = 0; i <= 10; i++) {
    cellPositions[i] = { row: 11, col: 11 - i, side: 'bottom' };
  }
  // 左側列：位置 11-19，row 10 到 row 2
  for (let i = 11; i <= 19; i++) {
    cellPositions[i] = { row: 10 - (i - 11), col: 1, side: 'left' };
  }
  // 頂部行：位置 20-30，col 1 到 col 11
  for (let i = 20; i <= 30; i++) {
    cellPositions[i] = { row: 1, col: i - 19, side: 'top' };
  }
  // 右側列：位置 31-39，row 2 到 row 10
  for (let i = 31; i <= 39; i++) {
    cellPositions[i] = { row: i - 29, col: 11, side: 'right' };
  }

  // 建立 11x11 的格子 + 中央
  const cells = {};
  for (let i = 0; i < 40; i++) {
    cells[i] = cellPositions[i];
  }

  // 排列格子依照 grid 順序
  // Row 1: positions 20-30
  // Row 2-10, Col 1: positions 19,18,...,11
  // Row 2-10, Col 11: positions 31,32,...,39
  // Row 11: positions 10,9,...,0
  // Center: row 2-10, col 2-10

  // 依 grid 順序 (row by row) 創建元素
  for (let row = 1; row <= 11; row++) {
    for (let col = 1; col <= 11; col++) {
      // 中央區域
      if (row >= 2 && row <= 10 && col >= 2 && col <= 10) {
        if (row === 2 && col === 2) {
          const center = document.createElement('div');
          center.className = 'board-center';
          center.style.gridColumn = '2 / 11';
          center.style.gridRow = '2 / 11';
          center.innerHTML = `
            <div class="center-art-frame">
              <img class="center-art-image" src="images/houston-theme.png" alt="Houstonopoly 主視覺">
            </div>
            <div class="dice-container mt-2 justify-center" style="display:none" id="center-dice"></div>
          `;
          grid.appendChild(center);
        }
        continue;
      }

      // 找到這個位置對應的格子
      let spaceIdx = -1;
      for (let i = 0; i < 40; i++) {
        if (cells[i].row === row && cells[i].col === col) {
          spaceIdx = i;
          break;
        }
      }

      if (spaceIdx === -1) continue;

      const space = SPACES[spaceIdx];
      const pos = cells[spaceIdx];
      const cell = document.createElement('div');
      cell.id = `cell-${spaceIdx}`;
      cell.style.gridRow = row;
      cell.style.gridColumn = col;
      cell.onclick = () => showPropertyInfo(spaceIdx);

      const isCorner = [0,10,20,30].includes(spaceIdx);
      if (isCorner) {
        cell.className = 'cell corner-cell';
        cell.innerHTML = getCornerHTML(spaceIdx, space);
      } else {
        cell.className = `cell ${pos.side}`;
        cell.innerHTML = getCellHTML(spaceIdx, space, pos.side);
      }

      grid.appendChild(cell);
    }
  }
}

function getCornerHTML(idx, space) {
  const icons = { 0: '🏙️', 10: '🔒', 20: '🅿️', 30: '👮' };
  return `
    <div class="corner-icon">${icons[idx]}</div>
    <div class="corner-label">${getBoardSpaceName(idx)}</div>
    <div class="cell-tokens" id="tokens-${idx}"></div>
  `;
}

function getCellHTML(idx, space, side) {
  let html = '';
  // 顏色條
  if (space.type === 'property' && space.color) {
    html += `<div class="color-bar" style="background:${COLOR_HEX[space.color]}"></div>`;
  }
  // 圖示
  const typeIcons = {
    railroad: '🚂', utility: '⚡', chance: '❓', community: '💰',
    tax: '💸',
  };
  if (space.type === 'utility' && space.name.includes('Water')) {
    html += `<div style="font-size:10px">💧</div>`;
  } else if (typeIcons[space.type]) {
    html += `<div style="font-size:10px">${typeIcons[space.type]}</div>`;
  }
  // 名稱
  html += `<div class="cell-name">${getBoardSpaceName(idx)}</div>`;
  // 價格
  if (space.price) {
    html += `<div class="cell-price">$${space.price}</div>`;
  }
  if (space.type === 'tax') {
    html += `<div class="cell-price">$${space.amount}</div>`;
  }
  // 房子
  html += `<div class="cell-houses" id="houses-${idx}"></div>`;
  // 玩家 token
  html += `<div class="cell-tokens" id="tokens-${idx}"></div>`;
  return html;
}

// ===== 渲染所有 UI =====
function renderAll() {
  renderTokensOnBoard();
  renderPlayerPanels();
  renderTurnInfo();
  renderHouses();
}

function renderTokensOnBoard() {
  // 清除所有 token
  for (let i = 0; i < 40; i++) {
    const el = document.getElementById(`tokens-${i}`);
    if (el) el.innerHTML = '';
  }
  // 放置玩家 token
  game.players.forEach(p => {
    if (p.bankrupt) return;
    const el = document.getElementById(`tokens-${p.position}`);
    if (el) {
      const span = document.createElement('span');
      span.className = `cell-token ${p.id === game.currentPlayer ? 'current-player' : ''}`;
      span.style.setProperty('--token-color', PLAYER_COLORS[p.id % PLAYER_COLORS.length]);
      span.title = `${p.name}（玩家 ${p.id + 1}）`;
      span.innerHTML = `
        <span class="token-emoji">${p.token}</span>
        <span class="token-badge">${p.id + 1}</span>
      `;
      el.appendChild(span);
    }
  });
}

function renderHouses() {
  for (let i = 0; i < 40; i++) {
    const el = document.getElementById(`houses-${i}`);
    if (!el) continue;
    el.innerHTML = '';
    const space = SPACES[i];
    if (space.type !== 'property') continue;
    // 找到擁有者
    const owner = game.players.find(p => p.properties.includes(i));
    if (!owner) continue;
    const prop = getPropertyState(owner, i);
    if (!prop) continue;
    if (prop.mortgaged) {
      el.innerHTML = '<span style="font-size:7px;color:#999">M</span>';
    } else if (prop.houses === 5) {
      el.innerHTML = '🚀';
    } else {
      for (let h = 0; h < prop.houses; h++) {
        el.innerHTML += '🛢️';
      }
    }
  }
}

function renderPlayerPanels() {
  const container = document.getElementById('player-panels');
  container.innerHTML = '';
  game.players.forEach((p, i) => {
    const isActive = i === game.currentPlayer && !p.bankrupt;
    const panel = document.createElement('div');
    panel.className = `player-panel ${isActive ? 'active' : ''} ${p.bankrupt ? 'bankrupt' : ''} min-w-40 lg:min-w-0`;
    panel.style.setProperty('--player-accent', PLAYER_COLORS[i % PLAYER_COLORS.length]);

    const propCount = p.properties.length;
    const propValue = p.properties.reduce((s, idx) => s + SPACES[idx].price, 0);

    panel.innerHTML = `
      <div class="flex items-center gap-2 mb-1">
        <span class="player-ident" style="--token-color:${PLAYER_COLORS[i % PLAYER_COLORS.length]}">
          <span>${p.token}</span>
          <span class="player-ident-badge">${i + 1}</span>
        </span>
        <span class="font-bold text-sm ${isActive ? 'text-orange-400' : 'text-gray-300'}">${p.name}</span>
        ${p.isAI ? '<span class="text-xs text-gray-500">🤖</span>' : ''}
        ${p.bankrupt ? '<span class="text-xs text-red-400">💀破產</span>' : ''}
        ${p.inJail ? '<span class="text-xs text-yellow-400">🔒</span>' : ''}
      </div>
      <div class="text-lg font-bold ${p.money < 100 ? 'text-red-400' : 'text-green-400'}">$${p.money.toLocaleString()}</div>
      <div class="text-xs text-gray-400">${propCount} ${tr('地產', 'properties')} (${tr('值', 'worth')} $${propValue})</div>
      ${p.jailFreeCards > 0 ? '<div class="text-xs text-yellow-300">🆓 ' + tr('出獄卡', 'Jail Card') + ' x' + p.jailFreeCards + '</div>' : ''}
    `;

    // 展開地產列表
    if (propCount > 0 && !p.bankrupt) {
      const propList = document.createElement('div');
      propList.className = 'mt-1 space-y-0.5';
      p.properties.forEach(idx => {
        const sp = SPACES[idx];
        const ps = getPropertyState(p, idx);
        const dot = sp.color ? `<span style="color:${COLOR_HEX[sp.color]}">●</span>` : '🚂';
        const mortgaged = ps && ps.mortgaged ? ` <span class="text-gray-500">[${tr('抵押', 'Mortgaged')}]</span>` : '';
        const houses = ps && ps.houses > 0 ? (ps.houses === 5 ? ' 🚀' : ' ' + '🛢️'.repeat(ps.houses)) : '';
        propList.innerHTML += `<div class="text-xs text-gray-400">${dot} ${getSpaceName(idx)}${houses}${mortgaged}</div>`;
      });
      panel.appendChild(propList);
    }

    container.appendChild(panel);
  });
}

function renderTurnInfo() {
  const p = game.players[game.currentPlayer];
  document.getElementById('turn-info').innerHTML = currentLang === 'zh'
    ? `${p.token} <strong>${p.name}</strong> ${t('turn')} ${p.isAI ? '🤖' : ''}`
    : `${p.token} <strong>${p.name}</strong>${t('turn')} ${p.isAI ? '🤖' : ''}`;
}

// ===== 回合控制 =====
function startTurn() {
  const p = getCurrentPlayer();
  if (p.bankrupt) { nextPlayer(); return; }

  game.phase = 'rolling';
  game.doublesCount = 0;
  updateButtons();
  renderAll();

  if (p.isAI) {
    setTimeout(() => aiTurn(), 800);
  }
}

function getCurrentPlayer() {
  return game.players[game.currentPlayer];
}

function updateButtons() {
  if (!game.players.length) return;
  const p = getCurrentPlayer();
  const hide = el => el.classList.add('hidden');
  const show = el => el.classList.remove('hidden');

  const btnRoll = document.getElementById('roll-btn');
  const btnBuy = document.getElementById('btn-buy');
  const btnBuild = document.getElementById('btn-build');
  const btnMortgage = document.getElementById('btn-mortgage');
  const btnEnd = document.getElementById('btn-end-turn');
  const btnPayJail = document.getElementById('btn-pay-jail');
  const btnRollJail = document.getElementById('btn-roll-jail');

  btnRoll.textContent = t('roll');
  btnBuy.textContent = t('buy');
  btnBuild.textContent = t('build');
  btnMortgage.textContent = t('mortgage');
  btnEnd.textContent = t('endTurn');
  btnPayJail.textContent = t('payJail');
  btnRollJail.textContent = t('rollJail');

  [btnRoll, btnBuy, btnBuild, btnMortgage, btnEnd, btnPayJail, btnRollJail].forEach(hide);

  if (p.bankrupt || p.isAI) return;

  if (p.inJail) {
    if (game.phase === 'rolling') {
      show(btnRollJail);
      if (p.money >= 50) show(btnPayJail);
      if (p.jailFreeCards > 0) {
        btnPayJail.textContent = t('useJailCard');
        show(btnPayJail);
      }
    }
    if (game.phase === 'rolled' || game.phase === 'action') {
      show(btnEnd);
      if (canBuild(p)) show(btnBuild);
      if (p.properties.length > 0) show(btnMortgage);
    }
    return;
  }

  if (game.phase === 'rolling') {
    show(btnRoll);
  }
  if (game.phase === 'rolled' || game.phase === 'action') {
    // 可以買地？
    const space = SPACES[p.position];
    if (space.price && !getOwner(p.position) && p.money >= space.price) {
      show(btnBuy);
    }
    if (canBuild(p)) show(btnBuild);
    if (p.properties.length > 0) show(btnMortgage);
    show(btnEnd);
  }
}

// ===== 骰子 =====
function rollDice() {
  const p = getCurrentPlayer();
  if (p.isAI && !p._aiRolling) return;
  if (game.phase !== 'rolling') return;

  playSound('roll');

  const die1El = document.getElementById('die1');
  const die2El = document.getElementById('die2');
  die1El.classList.add('rolling');
  die2El.classList.add('rolling');

  let rollCount = 0;
  const rollInterval = setInterval(() => {
    die1El.textContent = Math.floor(Math.random() * 6) + 1;
    die2El.textContent = Math.floor(Math.random() * 6) + 1;
    rollCount++;
    if (rollCount > 8) {
      clearInterval(rollInterval);
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      die1El.textContent = d1;
      die2El.textContent = d2;
      die1El.classList.remove('rolling');
      die2El.classList.remove('rolling');
      handleDiceResult(d1, d2);
    }
  }, 80);
}

function handleDiceResult(d1, d2) {
  const p = getCurrentPlayer();
  const total = d1 + d2;
  const isDoubles = d1 === d2;
  const resultEl = document.getElementById('dice-result');

  // 在監獄中
  if (p.inJail) {
    if (isDoubles) {
      p.inJail = false;
      p.jailTurns = 0;
      logMsg(tr(`${p.token} ${p.name} 擲出雙 ${d1}！出獄了！`, `${p.token} ${p.name} rolled doubles ${d1}! Out of jail!`));
      resultEl.textContent = tr(`雙 ${d1}！出獄！`, `Doubles ${d1}! Out of jail!`);
      movePlayer(p, total);
    } else {
      p.jailTurns++;
      if (p.jailTurns >= 3) {
        // 強制付錢出獄
        p.money -= 50;
        p.inJail = false;
        p.jailTurns = 0;
        logMsg(tr(`${p.token} ${p.name} 三次未擲出雙，付 $50 出獄`, `${p.token} ${p.name} failed to roll doubles in 3 tries and paid $50 to get out`));
        checkBankrupt(p);
        if (p.bankrupt) {
          resultEl.textContent = tr('資產不足，已破產', 'Insufficient funds, bankrupt');
          renderAll();
          updateButtons();
          return;
        }
        movePlayer(p, total);
      } else {
        logMsg(tr(`${p.token} ${p.name} 未擲出雙，繼續坐牢 (${p.jailTurns}/3)`, `${p.token} ${p.name} did not roll doubles and stays in jail (${p.jailTurns}/3)`));
        resultEl.textContent = tr(`${d1}+${d2}=${total}，未擲出雙`, `${d1}+${d2}=${total}, no doubles`);
        game.phase = 'rolled';
        updateButtons();
        renderAll();
        if (p.isAI) setTimeout(() => aiAction(), 500);
      }
    }
    return;
  }

  // 連續雙判定
  if (isDoubles) {
    game.doublesCount++;
    if (game.doublesCount >= 3) {
      logMsg(tr(`${p.token} ${p.name} 連擲三次雙！進監獄！`, `${p.token} ${p.name} rolled three doubles in a row! Go to jail!`));
      goToJail(p);
      return;
    }
    resultEl.textContent = tr(
      `${d1}+${d2}=${total} 🎯 雙！再擲一次`,
      `${d1}+${d2}=${total} 🎯 Doubles! Roll again.`
    );
  } else {
    game.doublesCount = 0;
    resultEl.textContent = `${d1}+${d2}=${total}`;
  }

  movePlayer(p, total);
}

// ===== 移動玩家 =====
function movePlayer(player, steps) {
  const oldPos = player.position;
  let newPos = (oldPos + steps) % 40;

  // 經過 GO 領 $200
  if (newPos < oldPos && newPos !== 0) {
    player.money += 200;
    logMsg(tr(`${player.token} ${player.name} 經過 GO，領 $200！`, `${player.token} ${player.name} passed GO and collected $200!`));
    playSound('collect');
  }

  player.position = newPos;

  // 動畫移動
  animateMove(player, oldPos, newPos, steps, () => {
    game.phase = 'rolled';
    handleLanding(player);
    renderAll();
    updateButtons();
    if (player.isAI) setTimeout(() => aiAction(), 600);
  });
}

function animateMove(player, from, to, steps, callback) {
  // 簡化動畫：逐格移動
  let current = from;
  let moved = 0;
  const interval = setInterval(() => {
    current = (current + 1) % 40;
    moved++;
    player.position = current;
    renderTokensOnBoard();

    if (moved >= steps) {
      clearInterval(interval);
      callback();
    }
  }, 100);
}

// ===== 落地處理 =====
function handleLanding(player) {
  const space = SPACES[player.position];
  logMsg(tr(`${player.token} ${player.name} 到達 ${getSpaceName(player.position)}`, `${player.token} ${player.name} landed on ${getSpaceName(player.position)}`));

  switch (space.type) {
    case 'go':
      // 剛好停在 GO 也領 $200（已經在移動時領過）
      if (player.position === 0) {
        player.money += 200;
        logMsg(tr(`${player.token} 停在 GO！額外領 $200！`, `${player.token} landed on GO and collected an extra $200!`));
        playSound('collect');
      }
      break;

    case 'property':
    case 'railroad':
    case 'utility':
      handlePropertyLanding(player, space);
      break;

    case 'tax':
      player.money -= space.amount;
      logMsg(tr(`${player.token} 繳稅 $${space.amount}`, `${player.token} paid tax of $${space.amount}`));
      checkBankrupt(player);
      break;

    case 'chance':
      drawCard(player, 'chance');
      break;

    case 'community':
      drawCard(player, 'community');
      break;

    case 'gotojail':
      logMsg(tr(`${player.token} ${player.name} 被抓進監獄！`, `${player.token} ${player.name} was sent to jail!`));
      goToJail(player);
      break;

    case 'jail':
      // Just visiting
      logMsg(tr(`${player.token} 只是路過監獄`, `${player.token} is just visiting jail`));
      break;

    case 'free':
      logMsg(tr(`${player.token} 免費停車，休息一下 ☕`, `${player.token} landed on Free Parking. Take a break ☕`));
      break;
  }
}

function handlePropertyLanding(player, space) {
  const pos = player.position;
  const owner = getOwner(pos);

  if (!owner) {
    // 無主地
    if (player.money >= space.price) {
      game.phase = 'action';
      if (!player.isAI) {
        logMsg(tr(`💡 ${getSpaceName(pos)} 可購買！$${space.price}`, `💡 ${getSpaceName(pos)} is available to buy for $${space.price}!`));
      }
    }
  } else if (owner.id !== player.id && !owner.bankrupt) {
    // 付租金
    const ps = getPropertyState(owner, pos);
    if (ps && ps.mortgaged) {
      logMsg(tr(`${getSpaceName(pos)} 已抵押，免租金`, `${getSpaceName(pos)} is mortgaged, so no rent is due`));
      return;
    }
    const rent = calculateRent(owner, pos, space);
    player.money -= rent;
    owner.money += rent;
    logMsg(tr(`${player.token} 付租金 $${rent} 給 ${owner.token} ${owner.name}`, `${player.token} paid $${rent} rent to ${owner.token} ${owner.name}`));
    playSound('collect');
    checkBankrupt(player, owner);
  } else if (owner.id === player.id) {
    logMsg(tr(`${player.token} 回到自己的地盤 ${getSpaceName(pos)}`, `${player.token} returned to their own property: ${getSpaceName(pos)}`));
  }
}

// ===== 租金計算 =====
function calculateRent(owner, pos, space) {
  if (space.type === 'railroad') {
    const railroads = owner.properties.filter(i => SPACES[i].type === 'railroad');
    const rents = [25, 50, 100, 200];
    return rents[railroads.length - 1] || 25;
  }
  if (space.type === 'utility') {
    const utilities = owner.properties.filter(i => SPACES[i].type === 'utility');
    const d1 = parseInt(document.getElementById('die1').textContent) || 1;
    const d2 = parseInt(document.getElementById('die2').textContent) || 1;
    const multiplier = utilities.length >= 2 ? 10 : 4;
    return (d1 + d2) * multiplier;
  }
  // 一般地產
  const ps = getPropertyState(owner, pos);
  if (!ps) return space.rent[0];
  if (ps.houses > 0) {
    return space.rent[ps.houses];
  }
  // 是否壟斷（同色全收）
  if (hasMonopoly(owner, space.color)) {
    return space.rent[0] * 2;
  }
  return space.rent[0];
}

// ===== 地產管理 =====
function getOwner(pos) {
  return game.players.find(p => p.properties.includes(pos) && !p.bankrupt);
}

function getPropertyState(player, pos) {
  if (!player._propState) player._propState = {};
  if (!player._propState[pos]) {
    player._propState[pos] = { houses: 0, mortgaged: false };
  }
  return player._propState[pos];
}

function hasMonopoly(player, color) {
  if (!color) return false;
  const colorProps = SPACES.reduce((arr, sp, i) => {
    if (sp.type === 'property' && sp.color === color) arr.push(i);
    return arr;
  }, []);
  return colorProps.every(i => player.properties.includes(i));
}

function canBuild(player) {
  // 檢查是否有任何壟斷的顏色組可以蓋房子
  const colors = new Set(player.properties.map(i => SPACES[i].color).filter(Boolean));
  for (const color of colors) {
    if (hasMonopoly(player, color)) {
      const props = player.properties.filter(i => SPACES[i].color === color);
      for (const i of props) {
        const ps = getPropertyState(player, i);
        if (!ps.mortgaged && ps.houses < 5 && player.money >= SPACES[i].buildCost) {
          return true;
        }
      }
    }
  }
  return false;
}

// ===== 購買地產 =====
function buyProperty() {
  const p = getCurrentPlayer();
  const space = SPACES[p.position];
  if (!space.price || getOwner(p.position) || p.money < space.price) return;

  p.money -= space.price;
  p.properties.push(p.position);
  if (!p._propState) p._propState = {};
  p._propState[p.position] = { houses: 0, mortgaged: false };

  logMsg(tr(`${p.token} ${p.name} 購買了 ${getSpaceName(p.position)}！$${space.price}`, `${p.token} ${p.name} bought ${getSpaceName(p.position)} for $${space.price}!`));
  playSound('buy');
  renderAll();
  updateButtons();
}

// ===== 蓋房子 =====
function showBuildMenu() {
  const p = getCurrentPlayer();
  const colors = new Set(p.properties.map(i => SPACES[i].color).filter(Boolean));
  let html = '<div class="space-y-3">';

  for (const color of colors) {
    if (!hasMonopoly(p, color)) continue;
    const props = p.properties.filter(i => SPACES[i].color === color);
    html += `<div class="border border-gray-600 rounded p-2">
      <div class="flex items-center gap-2 mb-2">
        <span style="color:${COLOR_HEX[color]}">●●●</span>
        <span class="text-sm font-bold">${COLOR_NAME_I18N[color]?.[currentLang] || color} ${tr('區', 'Set')}</span>
      </div>`;

    for (const i of props) {
      const sp = SPACES[i];
      const ps = getPropertyState(p, i);
      const canBuildHere = !ps.mortgaged && ps.houses < 5 && p.money >= sp.buildCost;
      // 均勻建造檢查
      const minH = Math.min(...props.map(j => getPropertyState(p, j).houses));
      const canBuildEven = ps.houses <= minH;
      const enabled = canBuildHere && canBuildEven;

      html += `<div class="flex items-center justify-between text-sm py-1">
        <span>${getSpaceName(i)} ${ps.houses === 5 ? '🚀' : '🛢️'.repeat(ps.houses)}</span>
        <button onclick="buildHouse(${i})" class="btn btn-sm ${enabled ? 'btn-orange' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}"
          ${enabled ? '' : 'disabled'}>
          +🛢️ $${sp.buildCost}
        </button>
      </div>`;
    }
    html += '</div>';
  }
  html += '</div>';

  showModal(tr('🛢️ 蓋房子（石油桶）/ 🚀 旅館（太空艙）', '🛢️ Build Houses / 🚀 Space Hotel'), html);
}

function buildHouse(propIdx) {
  const p = getCurrentPlayer();
  const sp = SPACES[propIdx];
  const ps = getPropertyState(p, propIdx);

  p.money -= sp.buildCost;
  ps.houses++;
  logMsg(tr(
    `${p.token} 在 ${getSpaceName(propIdx)} 蓋了${ps.houses === 5 ? '太空艙旅館 🚀' : '石油桶 🛢️'} (${ps.houses}/5)`,
    `${p.token} built ${ps.houses === 5 ? 'a space hotel 🚀' : 'a house 🛢️'} on ${getSpaceName(propIdx)} (${ps.houses}/5)`
  ));
  playSound('buy');
  renderAll();
  updateButtons();
  closeModal();
  if (canBuild(p)) showBuildMenu();
}

// ===== 抵押 =====
function showMortgageMenu() {
  const p = getCurrentPlayer();
  let html = '<div class="space-y-2">';

  p.properties.forEach(i => {
    const sp = SPACES[i];
    const ps = getPropertyState(p, i);
    const mortVal = Math.floor(sp.price / 2);
    const unmortVal = Math.floor(sp.price * 0.55);

    if (ps.mortgaged) {
      html += `<div class="flex items-center justify-between text-sm py-1 text-gray-400">
        <span>${getSpaceName(i)} [${tr('已抵押', 'Mortgaged')}]</span>
        <button onclick="unmortgage(${i})" class="btn btn-sm ${p.money >= unmortVal ? 'btn-primary' : 'bg-gray-700 text-gray-500'}"
          ${p.money >= unmortVal ? '' : 'disabled'}>
          ${tr('解除', 'Lift')} $${unmortVal}
        </button>
      </div>`;
    } else if (ps.houses === 0) {
      html += `<div class="flex items-center justify-between text-sm py-1">
        <span>${getSpaceName(i)}</span>
        <button onclick="mortgage(${i})" class="btn btn-sm btn-danger">
          ${tr('抵押', 'Mortgage')} +$${mortVal}
        </button>
      </div>`;
    } else {
      html += `<div class="flex items-center justify-between text-sm py-1 text-gray-500">
        <span>${getSpaceName(i)} (${tr('有建築，無法抵押', 'Has buildings, cannot mortgage')})</span>
      </div>`;
    }
  });

  html += '</div>';
  showModal(tr('🏦 抵押管理', '🏦 Mortgage Manager'), html);
}

function mortgage(propIdx) {
  const p = getCurrentPlayer();
  const sp = SPACES[propIdx];
  const ps = getPropertyState(p, propIdx);
  const mortVal = Math.floor(sp.price / 2);

  ps.mortgaged = true;
  p.money += mortVal;
  logMsg(tr(`${p.token} 抵押 ${getSpaceName(propIdx)}，獲得 $${mortVal}`, `${p.token} mortgaged ${getSpaceName(propIdx)} for $${mortVal}`));
  renderAll();
  closeModal();
  showMortgageMenu();
}

function unmortgage(propIdx) {
  const p = getCurrentPlayer();
  const sp = SPACES[propIdx];
  const ps = getPropertyState(p, propIdx);
  const unmortVal = Math.floor(sp.price * 0.55);

  ps.mortgaged = false;
  p.money -= unmortVal;
  logMsg(tr(`${p.token} 解除抵押 ${getSpaceName(propIdx)}，付 $${unmortVal}`, `${p.token} lifted the mortgage on ${getSpaceName(propIdx)} for $${unmortVal}`));
  renderAll();
  closeModal();
  showMortgageMenu();
}

// ===== 出獄 =====
function payJailFine() {
  const p = getCurrentPlayer();
  if (p.jailFreeCards > 0) {
    p.jailFreeCards--;
    p.inJail = false;
    p.jailTurns = 0;
    logMsg(tr(`${p.token} 使用出獄自由卡！`, `${p.token} used a Get Out of Jail Free card!`));
  } else if (p.money >= 50) {
    p.money -= 50;
    p.inJail = false;
    p.jailTurns = 0;
    logMsg(tr(`${p.token} 付 $50 出獄`, `${p.token} paid $50 to leave jail`));
  }
  game.phase = 'rolling';
  renderAll();
  updateButtons();
  if (p.isAI) setTimeout(() => aiTurn(), 500);
}

function goToJail(player) {
  player.position = 10;
  player.inJail = true;
  player.jailTurns = 0;
  playSound('jail');
  game.phase = 'rolled';
  game.doublesCount = 0;
  renderAll();
  updateButtons();
  if (player.isAI) setTimeout(() => aiAction(), 500);
}

// ===== 卡片 =====
function drawCard(player, type) {
  let card, deckName;
  let cardIdx;
  if (type === 'chance') {
    const idx = game.chanceDeck[game.chanceIdx % game.chanceDeck.length];
    cardIdx = idx;
    card = CHANCE_CARDS[idx];
    game.chanceIdx++;
    deckName = tr('機會', 'Chance');
  } else {
    const idx = game.communityDeck[game.communityIdx % game.communityDeck.length];
    cardIdx = idx;
    card = COMMUNITY_CARDS[idx];
    game.communityIdx++;
    deckName = tr('公共基金', 'Community Chest');
  }

  const localizedText = getCardText(type, cardIdx);
  logMsg(tr(`🃏 ${player.token} 抽到${deckName}卡：${localizedText}`, `🃏 ${player.token} drew a ${deckName} card: ${localizedText}`));

  // 顯示卡片
  if (!player.isAI) {
    showModal(`🃏 ${deckName}`, `
      <div class="card-display ${type === 'chance' ? 'chance' : 'community'}">
        <div class="text-lg mb-2">${localizedText}</div>
      </div>
      <button onclick="closeModal()" class="btn btn-orange w-full mt-3">${tr('確定', 'Confirm')}</button>
    `);
  }

  executeCard(player, card);
}

function executeCard(player, card) {
  switch (card.action) {
    case 'pay':
      player.money -= card.amount;
      checkBankrupt(player);
      break;
    case 'receive':
      player.money += card.amount;
      playSound('collect');
      break;
    case 'collect_all':
      game.players.forEach(other => {
        if (other.id !== player.id && !other.bankrupt) {
          other.money -= card.amount;
          player.money += card.amount;
          checkBankrupt(other, player);
        }
      });
      playSound('collect');
      break;
    case 'moveto':
      const oldPos = player.position;
      player.position = card.dest;
      if (card.dest <= oldPos && card.dest !== 30) {
        player.money += 200;
        logMsg(tr(`${player.token} 經過 GO，領 $200`, `${player.token} passed GO and collected $200`));
      }
      game.phase = 'rolled';
      handleLanding(player);
      break;
    case 'back':
      player.position = (player.position - card.steps + 40) % 40;
      game.phase = 'rolled';
      handleLanding(player);
      break;
    case 'gotojail':
      goToJail(player);
      break;
    case 'jail_free':
      player.jailFreeCards++;
      break;
    case 'repair':
      let cost = 0;
      player.properties.forEach(i => {
        const ps = getPropertyState(player, i);
        if (ps.houses === 5) cost += card.hotel;
        else cost += ps.houses * card.house;
      });
      player.money -= cost;
      logMsg(tr(`${player.token} 維修費用 $${cost}`, `${player.token} paid $${cost} in repair costs`));
      checkBankrupt(player);
      break;
    case 'nearest_railroad':
      const railroads = [5, 15, 25, 35];
      let nearest = railroads.find(r => r > player.position) || railroads[0];
      const oldP = player.position;
      player.position = nearest;
      if (nearest < oldP) {
        player.money += 200;
        logMsg(tr(`${player.token} 經過 GO，領 $200`, `${player.token} passed GO and collected $200`));
      }
      game.phase = 'rolled';
      handleLanding(player);
      break;
  }
  renderAll();
}

// ===== 破產 =====
function checkBankrupt(player, creditor) {
  if (player.money >= 0) return;

  // 嘗試自動抵押
  const unmortgaged = player.properties.filter(i => {
    const ps = getPropertyState(player, i);
    return ps && !ps.mortgaged && ps.houses === 0;
  });

  // AI 自動抵押
  if (player.isAI) {
    for (const i of unmortgaged) {
      if (player.money >= 0) break;
      const mortVal = Math.floor(SPACES[i].price / 2);
      getPropertyState(player, i).mortgaged = true;
      player.money += mortVal;
      logMsg(tr(`${player.token} 自動抵押 ${getSpaceName(i)} +$${mortVal}`, `${player.token} auto-mortgaged ${getSpaceName(i)} for +$${mortVal}`));
    }
  }

  if (player.money < 0) {
    player.bankrupt = true;
    logMsg(tr(`💀 ${player.token} ${player.name} 破產了！`, `💀 ${player.token} ${player.name} is bankrupt!`));
    playSound('bankrupt');

    // 轉移資產
    if (creditor) {
      player.properties.forEach(i => {
        creditor.properties.push(i);
        if (player._propState && player._propState[i]) {
          if (!creditor._propState) creditor._propState = {};
          creditor._propState[i] = player._propState[i];
        }
      });
      logMsg(tr(`${creditor.token} 接收了 ${player.token} 的所有資產`, `${creditor.token} took over all assets from ${player.token}`));
    }
    player.properties = [];

    checkGameOver();
  }
}

// ===== 結束回合 =====
function endTurn() {
  const p = getCurrentPlayer();
  const d1 = parseInt(document.getElementById('die1').textContent);
  const d2 = parseInt(document.getElementById('die2').textContent);

  // 如果擲了雙而且沒在監獄中，再擲一次
  if (d1 === d2 && !p.inJail && game.doublesCount > 0 && game.doublesCount < 3) {
    game.phase = 'rolling';
    logMsg(tr(`🎯 ${p.token} 擲了雙！再擲一次！`, `🎯 ${p.token} rolled doubles! Roll again!`));
    updateButtons();
    if (p.isAI) setTimeout(() => aiTurn(), 800);
    return;
  }

  nextPlayer();
}

function nextPlayer() {
  const activePlayers = game.players.filter(p => !p.bankrupt);
  if (activePlayers.length <= 1) {
    checkGameOver();
    return;
  }

  if (checkGameOver()) return;

  do {
    game.currentPlayer = (game.currentPlayer + 1) % game.players.length;
  } while (game.players[game.currentPlayer].bankrupt);

  game.doublesCount = 0;
  document.getElementById('dice-result').textContent = '';
  startTurn();
}

// ===== 勝負判定 =====
function checkGameOver() {
  const alive = game.players.filter(p => !p.bankrupt);
  const humanPlayers = game.players.filter(p => !p.isAI);
  const survivingHumans = humanPlayers.filter(p => !p.bankrupt);

  if (humanPlayers.length > 0 && survivingHumans.length === 0) {
    const winner = alive.sort((a, b) => b.money - a.money)[0] || null;
    game.phase = 'gameover';
    logMsg(tr('🏁 所有人類玩家都破產了，遊戲結束！', '🏁 All human players are bankrupt. Game over!'));
    if (winner) {
      logMsg(tr(`🏆 ${winner.token} ${winner.name} 成為最後勝利方！`, `🏆 ${winner.token} ${winner.name} is the final winner!`));
    }
    playSound('win');
    showVictory(winner);
    return true;
  }

  if (humanPlayers.length === 0 && alive.length <= 1) {
    const winner = alive[0] || null;
    game.phase = 'gameover';
    if (winner) {
      logMsg(tr(`🏆 ${winner.token} ${winner.name} 贏得了休士頓大富翁！`, `🏆 ${winner.token} ${winner.name} won Houstonopoly!`));
    } else {
      logMsg(tr('🏁 遊戲結束！', '🏁 Game over!'));
    }
    playSound('win');
    showVictory(winner);
    return true;
  }

  return false;
}

function showVictory(winner) {
  // 灑彩帶
  const emojis = ['🎉','⭐','🚀','🏆','🤠','⚾','🛸','💰','🎊','🔥'];
  for (let i = 0; i < 40; i++) {
    setTimeout(() => {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.animationDuration = (2 + Math.random() * 3) + 's';
      c.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 5000);
    }, i * 100);
  }

  showModal(t('victoryTitle'), `
    <div class="text-center">
      <div class="trophy">🏆</div>
      <h2 class="text-2xl font-bold text-orange-400 mt-4">${winner ? `${winner.token} ${winner.name}` : t('noWinner')}</h2>
      <p class="text-lg text-gray-300 mt-2">${winner ? t('victoryChampion') : t('gameEnded')}</p>
      <p class="text-sm text-gray-400 mt-1">${winner ? `${t('finalAssets')}: $${winner.money.toLocaleString()}` : t('allOut')}</p>
      <p class="text-sm text-gray-400">${winner ? `${t('properties')}: ${winner.properties.length}` : ''}</p>
      <div class="grid grid-cols-2 gap-2 mt-6">
        <button onclick="restartGame()" class="btn btn-orange w-full text-lg">${t('playAgain')}</button>
        <button onclick="leaveGame()" class="btn btn-danger w-full text-lg">${t('exit')}</button>
      </div>
    </div>
  `);
}

// ===== AI 邏輯 =====
function aiTurn() {
  const p = getCurrentPlayer();
  if (!p.isAI || p.bankrupt) return;

  // 在監獄中
  if (p.inJail) {
    if (p.jailFreeCards > 0) {
      p.jailFreeCards--;
      p.inJail = false;
      p.jailTurns = 0;
      logMsg(tr(`${p.token} 🤖 使用出獄卡`, `${p.token} 🤖 used a Get Out of Jail card`));
      game.phase = 'rolling';
      setTimeout(() => aiTurn(), 500);
    } else if (p.money > 200 && p.jailTurns < 2) {
      // 有錢就付
      payJailFineAI(p);
    } else {
      // 試擲雙
      p._aiRolling = true;
      game.phase = 'rolling';
      rollDice();
      p._aiRolling = false;
    }
    return;
  }

  p._aiRolling = true;
  game.phase = 'rolling';
  rollDice();
  p._aiRolling = false;
}

function payJailFineAI(p) {
  p.money -= 50;
  p.inJail = false;
  p.jailTurns = 0;
  logMsg(tr(`${p.token} 🤖 付 $50 出獄`, `${p.token} 🤖 paid $50 to leave jail`));
  game.phase = 'rolling';
  setTimeout(() => aiTurn(), 500);
}

function aiAction() {
  const p = getCurrentPlayer();
  if (!p.isAI || p.bankrupt) return;

  const space = SPACES[p.position];

  // 決定是否買地
  if (space.price && !getOwner(p.position) && p.money >= space.price) {
    // AI 策略：如果買得起且剩餘資金 > 100，就買
    if (p.money - space.price >= 100 || space.price <= 200) {
      buyPropertyAI(p);
    }
  }

  // 決定是否蓋房子
  if (canBuild(p)) {
    aiBuild(p);
  }

  // 結束回合
  setTimeout(() => endTurn(), 600);
}

function buyPropertyAI(p) {
  const space = SPACES[p.position];
  p.money -= space.price;
  p.properties.push(p.position);
  if (!p._propState) p._propState = {};
  p._propState[p.position] = { houses: 0, mortgaged: false };
  logMsg(tr(`${p.token} 🤖 購買了 ${getSpaceName(p.position)} $${space.price}`, `${p.token} 🤖 bought ${getSpaceName(p.position)} for $${space.price}`));
  playSound('buy');
  renderAll();
}

function aiBuild(p) {
  // AI 蓋房策略：每回合最多蓋 2 棟，保留至少 $200
  let built = 0;
  const colors = new Set(p.properties.map(i => SPACES[i].color).filter(Boolean));

  for (const color of colors) {
    if (!hasMonopoly(p, color) || built >= 2) continue;
    const props = p.properties.filter(i => SPACES[i].color === color);

    for (const i of props) {
      if (built >= 2) break;
      const sp = SPACES[i];
      const ps = getPropertyState(p, i);
      const minH = Math.min(...props.map(j => getPropertyState(p, j).houses));

      if (!ps.mortgaged && ps.houses <= minH && ps.houses < 5 &&
          p.money - sp.buildCost >= 200) {
        p.money -= sp.buildCost;
        ps.houses++;
        logMsg(tr(`${p.token} 🤖 在 ${getSpaceName(i)} 蓋了${ps.houses === 5 ? '🚀' : '🛢️'}`, `${p.token} 🤖 built ${ps.houses === 5 ? '🚀' : '🛢️'} on ${getSpaceName(i)}`));
        built++;
      }
    }
  }
  if (built > 0) {
    playSound('buy');
    renderAll();
  }
}

// ===== 地產資訊顯示 =====
function showPropertyInfo(idx) {
  const space = SPACES[idx];
  if (!space.price) return;

  const owner = getOwner(idx);
  const ps = owner ? getPropertyState(owner, idx) : null;

  let html = `<div class="space-y-2">`;
  if (space.color) {
    html += `<div class="h-3 rounded" style="background:${COLOR_HEX[space.color]}"></div>`;
  }
  html += `<div class="text-center text-xl font-bold">${getSpaceName(idx)}</div>`;
  html += `<div class="text-center text-gray-400">${tr('價格', 'Price')}: $${space.price}</div>`;

  if (owner) {
    html += `<div class="text-center text-sm">${tr('擁有者', 'Owner')}: ${owner.token} ${owner.name}</div>`;
    if (ps) {
      html += `<div class="text-center text-sm">${tr('建築', 'Buildings')}: ${ps.houses === 5 ? tr('🚀 太空艙旅館', '🚀 Space Hotel') : ps.houses > 0 ? '🛢️'.repeat(ps.houses) : tr('無', 'None')}</div>`;
      html += `<div class="text-center text-sm">${ps.mortgaged ? tr('🔒 已抵押', '🔒 Mortgaged') : tr('✅ 正常', '✅ Active')}</div>`;
    }
  } else {
    html += `<div class="text-center text-sm text-yellow-400">${tr('待售中', 'Available')}</div>`;
  }

  if (space.rent) {
    html += `<div class="border-t border-gray-600 pt-2 mt-2">
      <div class="text-xs text-gray-400">${tr('租金表', 'Rent Table')}:</div>
      <div class="grid grid-cols-2 gap-1 text-xs mt-1">
        <span>${tr('基本租金', 'Base Rent')}:</span><span class="text-right">$${space.rent[0]}</span>
        <span>${tr('壟斷(x2)', 'Monopoly (x2)')}:</span><span class="text-right">$${space.rent[0] * 2}</span>
        <span>1 🛢️：</span><span class="text-right">$${space.rent[1]}</span>
        <span>2 🛢️：</span><span class="text-right">$${space.rent[2]}</span>
        <span>3 🛢️：</span><span class="text-right">$${space.rent[3]}</span>
        <span>4 🛢️：</span><span class="text-right">$${space.rent[4]}</span>
        <span>${tr('🚀 旅館', '🚀 Hotel')}:</span><span class="text-right">$${space.rent[5]}</span>
      </div>
      <div class="text-xs text-gray-500 mt-1">${tr('建造費用', 'Build Cost')}: $${space.buildCost}/${tr('棟', 'unit')}</div>
      <div class="text-xs text-gray-500">${tr('抵押價值', 'Mortgage Value')}: $${Math.floor(space.price / 2)}</div>
    </div>`;
  }

  if (space.type === 'railroad') {
    html += `<div class="border-t border-gray-600 pt-2 mt-2 text-xs">
      <div>${tr('1 站', '1 Station')}: $25 | ${tr('2 站', '2 Stations')}: $50</div>
      <div>${tr('3 站', '3 Stations')}: $100 | ${tr('4 站', '4 Stations')}: $200</div>
    </div>`;
  }

  if (space.type === 'utility') {
    html += `<div class="border-t border-gray-600 pt-2 mt-2 text-xs">
      <div>${tr('1 間', '1 Utility')}: ${tr('骰子', 'Dice')} x4</div>
      <div>${tr('2 間', '2 Utilities')}: ${tr('骰子', 'Dice')} x10</div>
    </div>`;
  }

  html += `</div>`;
  html += `<button onclick="closeModal()" class="btn btn-primary w-full mt-3">${tr('關閉', 'Close')}</button>`;

  showModal(`📋 ${getSpaceName(idx)}`, html);
}

// ===== 規則 =====
function showRules() {
  showModal(t('rulesTitle'), `
    <div class="text-sm text-gray-300 space-y-2 max-h-60 overflow-y-auto">
      ${t('rulesBody').map(line => `<p>${line}</p>`).join('')}
    </div>
    <button onclick="closeModal()" class="btn btn-primary w-full mt-3">${t('ok')}</button>
  `);
}

function confirmRestartGame() {
  showModal(t('confirmRestartTitle'), `
    <div class="text-sm text-gray-300 space-y-3">
      <p>${t('confirmRestartBody')}</p>
      <div class="grid grid-cols-2 gap-2">
        <button onclick="restartGame()" class="btn btn-orange w-full">${t('restart')}</button>
        <button onclick="closeModal()" class="btn btn-primary w-full">${t('cancel')}</button>
      </div>
    </div>
  `);
}

function restartGame() {
  window.location.reload();
}

function confirmExitGame() {
  showModal(t('confirmExitTitle'), `
    <div class="text-sm text-gray-300 space-y-3">
      <p>${t('confirmExitBody')}</p>
      <div class="grid grid-cols-2 gap-2">
        <button onclick="leaveGame()" class="btn btn-danger w-full">${t('exit')}</button>
        <button onclick="closeModal()" class="btn btn-primary w-full">${t('keepPlaying')}</button>
      </div>
    </div>
  `);
}

function leaveGame() {
  window.location.href = 'index.html';
}

// ===== 彈窗 =====
function showModal(title, content) {
  const container = document.getElementById('modal-container');
  container.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-box" onclick="event.stopPropagation()">
        <div class="modal-title">${title}</div>
        ${content}
      </div>
    </div>
  `;
  container.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-container').classList.add('hidden');
}

// ===== 遊戲記錄 =====
function logMsg(msg) {
  const log = document.getElementById('game-log');
  const div = document.createElement('div');
  div.textContent = msg;
  div.style.borderBottom = '1px solid #1e3a5f';
  div.style.paddingBottom = '2px';
  log.prepend(div);
  // 保留最近 50 條
  while (log.children.length > 50) {
    log.removeChild(log.lastChild);
  }
}

// ===== 工具函數 =====
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ===== 棋盤大小自適應 =====
function resizeBoard() {
  const grid = document.getElementById('board-grid');
  if (!grid) return;

  const isMd = window.innerWidth >= 768;
  let size;
  if (isMd) {
    // md+ 三欄：扣除左面板 176 + 右面板 208 + gaps/padding ~40
    const availW = window.innerWidth - 176 - 208 - 48;
    const availH = window.innerHeight - 70;
    size = Math.min(availW, availH, 560);
  } else {
    // 手機：棋盤佔全寬，限制高度
    size = Math.min(window.innerWidth - 20, window.innerHeight * 0.52, 500);
  }
  size = Math.max(size, 280);
  grid.style.width = size + 'px';
  grid.style.height = size + 'px';
}

window.addEventListener('resize', resizeBoard);
window.addEventListener('load', () => {
  ['lang-toggle-setup', 'lang-toggle-game'].forEach(id => {
    const button = document.getElementById(id);
    if (!button) return;
    button.addEventListener('click', () => {
      currentLang = currentLang === 'zh' ? 'en' : 'zh';
      applyLanguage();
    });
  });
  initSetup();
  applyLanguage();
});

// 遊戲開始後調整棋盤大小
const origStartGame = startGame;
// 使用 MutationObserver 在遊戲畫面顯示後調整
new MutationObserver(() => {
  if (!document.getElementById('game-screen').classList.contains('hidden')) {
    setTimeout(resizeBoard, 100);
  }
}).observe(document.getElementById('game-screen'), { attributes: true });

