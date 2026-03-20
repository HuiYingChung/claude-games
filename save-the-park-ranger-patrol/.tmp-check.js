
// ============================================================
//  SAVE THE PARK: YELLOWSTONE RANGER PATROL
//  Complete Game Logic
// ============================================================

// ─── GLOBAL STATE ───────────────────────────────────────────
let gamePaused = false;
let _pausedScene = null;
let _rereadMode = false;

const state = {
  score: 0,
  parkHealth: 100,
  completedZones: [],      // ['geyser','bison','camp','trail']
  badges: [],
  currentScene: null,
  pausedScene: null,

  // Per-scene task tracking
  scenes: {
    geyser: {
      visitorCount: 0,      // need 2
      visitorTotal: 2,
      signDone: false,
      trashCount: 0,        // need 5
      trashTotal: 5,
      ropeFixed: 0,         // need 2 — repair fallen barrier ropes
      ropeTotal: 2,
      briefingDone: false,
      complete: false
    },
    bison: {
      visitorsFixed: 0,     // need 3
      visitorsTotal: 3,
      foodRemoved: 0,       // need 5
      foodTotal: 5,
      signDone: false,
      roadCleared: 0,       // need 2 — clear bison-jam vehicles
      roadTotal: 2,
      briefingDone: false,
      complete: false
    },
    camp: {
      foodStored: 0,        // need 5
      foodTotal: 5,
      trashRemoved: 0,      // need 3
      trashTotal: 3,
      fireDone: false,
      fire2Done: false,
      petCited: false,      // cite dog off leash
      bearPenaltyGiven: false,
      briefingDone: false,
      complete: false
    },
    trail: {
      visitorsFixed: 0,     // need 2
      visitorsTotal: 2,
      obstaclesCleared: 0,  // need 3
      obstaclesTotal: 3,
      litterRemoved: 0,     // need 2
      litterTotal: 2,
      signDone: false,
      erosionMarked: 0,     // need 2 — document erosion damage
      erosionTotal: 2,
      briefingDone: false,
      complete: false
    },
    lake: {
      visitorsFixed: 0,     // need 3
      visitorsTotal: 3,
      foodRemoved: 0,       // need 4
      foodTotal: 4,
      signDone: false,
      weedsRemoved: 0,      // need 3 — remove invasive aquatic plants
      weedTotal: 3,
      briefingDone: false,
      complete: false
    }
  },
  runtime: {
    geyser: { started:false, sceneTimeLeft:null, visitor3Pending:true, campFire2Pending:false, rangerEvents:{} },
    bison:  { started:false, sceneTimeLeft:null, visitor3Pending:false, campFire2Pending:false, rangerEvents:{} },
    camp:   { started:false, sceneTimeLeft:null, visitor3Pending:false, campFire2Pending:true, rangerEvents:{} },
    trail:  { started:false, sceneTimeLeft:null, visitor3Pending:false, campFire2Pending:false, rangerEvents:{} },
    lake:   { started:false, sceneTimeLeft:null, visitor3Pending:false, campFire2Pending:false, rangerEvents:{} }
  },
  questionSet: {
    geyser: null,
    bison: null,
    camp: null,
    trail: null,
    lake: null
  }
};

const RANGER_EVENT_DEFAULTS = {
  geyser: { 'g-selfie': 18000, 'g-collector': 32000 },
  bison:  { 'b-drone': 14000, 'b-feeder': 26000 },
  camp:   { 'c-noise': 15000, 'c-water': 24000, 'c-car': 33000 },
  trail:  { 't-biker': 10000, 't-invasive': 20000, 't-injured': 30000 },
  lake:   { 'l-wade': 13000, 'l-fish-rod': 28000 }
};

function createRuntimeState(scene) {
  return {
    started: false,
    sceneTimeLeft: null,
    visitor3Pending: scene === 'geyser',
    campFire2Pending: scene === 'camp',
    dogPatrolPrimed: scene === 'camp' ? false : null,
    rangerEvents: { ...(RANGER_EVENT_DEFAULTS[scene] || {}) }
  };
}

const QUESTION_BANKS = {
  geyser: [
    {
      prompt: 'What instruction should the ranger broadcast?',
      options: [
        'Stay on boardwalks and designated trails',
        'Move closer for a better photo',
        'Step carefully around the steam'
      ],
      correctIndex: 0,
      successMsg: 'Correct call. That matches Yellowstone thermal-area safety guidance.',
      failMsg: 'Too vague or unsafe. Thermal areas require visitors to stay on boardwalks and designated trails.'
    },
    {
      prompt: 'What is the safest reminder near hot springs?',
      options: [
        'Keep children on the boardwalk',
        'Test the ground before stepping off trail',
        'Walk quickly past the thermal pools'
      ],
      correctIndex: 0,
      successMsg: 'Correct. Visitors should stay on the boardwalk and keep children close in thermal areas.',
      failMsg: 'Unsafe choice. Thermal ground can break without warning.'
    },
    {
      prompt: 'What should visitors do around Yellowstone thermal features?',
      options: [
        'Stay on marked walkways',
        'Pick up colorful rocks as souvenirs',
        'Stand at the edge for a better view'
      ],
      correctIndex: 0,
      successMsg: 'Correct. Marked walkways protect both visitors and fragile thermal features.',
      failMsg: 'Not safe. Visitors should stay on marked walkways around thermal basins.'
    }
  ],
  bison: [
    {
      prompt: 'How far should people stay from bison?',
      options: [
        'At least 25 yards',
        '5 yards',
        'Only behind a parked car'
      ],
      correctIndex: 0,
      successMsg: 'Correct. Yellowstone requires at least 25 yards from bison and other non-predator wildlife.',
      failMsg: 'Too close. The official minimum distance is at least 25 yards.'
    },
    {
      prompt: 'What should a visitor do if a bison is near the road?',
      options: [
        'Stay in the vehicle or keep a 25-yard distance',
        'Walk closer if the herd looks calm',
        'Feed it to move it away from traffic'
      ],
      correctIndex: 0,
      successMsg: 'Correct. Distance and patience keep both people and wildlife safer.',
      failMsg: 'Unsafe choice. Never approach or feed bison.'
    },
    {
      prompt: 'Which ranger instruction is safest around wildlife jams?',
      options: [
        'Use pullouts and keep your distance',
        'Crowd closer for one quick photo',
        'Tap on the car window to make the bison move'
      ],
      correctIndex: 0,
      successMsg: 'Correct. Official wildlife viewing guidance emphasizes distance and safe pullouts.',
      failMsg: 'Not safe. Visitors should use pullouts and keep a safe distance.'
    }
  ],
  camp: [
    {
      prompt: 'What should campers do with scented items at night?',
      options: [
        'Store food and scented items in the locker',
        'Leave coolers under the table',
        'Keep snacks inside the tent'
      ],
      correctIndex: 0,
      successMsg: 'Exactly right. Yellowstone campgrounds require food and scented items to be secured.',
      failMsg: 'Not safe enough. Food and scented items need to be secured in the locker.'
    },
    {
      prompt: 'What belongs in a bear-safe locker?',
      options: [
        'Food, trash, and toiletries',
        'Only hot food after dark',
        'Nothing if campers stay nearby'
      ],
      correctIndex: 0,
      successMsg: 'Correct. Food, trash, and scented items should all be secured.',
      failMsg: 'Not correct. Bears are attracted to food, trash, and scented toiletries too.'
    },
    {
      prompt: 'What is the safest camping habit in bear country?',
      options: [
        'Clean up immediately and secure attractants',
        'Burn food wrappers in the fire ring',
        'Hide snacks inside sleeping bags'
      ],
      correctIndex: 0,
      successMsg: 'Correct. Fast cleanup and proper storage reduce bear conflicts.',
      failMsg: 'Unsafe choice. Campers should clean up and secure attractants, not hide or burn them.'
    }
  ],
  trail: [
    {
      prompt: 'What should the ranger tell hikers after rain damage?',
      options: [
        'Stay on maintained trails',
        'Find a shortcut around the mud',
        'Spread out to avoid crowding'
      ],
      correctIndex: 0,
      successMsg: 'Correct. Yellowstone advises hikers to stay on maintained trails.',
      failMsg: 'Not safe enough. The safest instruction is to stay on maintained trails.'
    },
    {
      prompt: 'What is the best response to muddy trail damage?',
      options: [
        'Walk through carefully and stay on the trail',
        'Step off the trail to protect your boots',
        'Cut a new path around the damaged spot'
      ],
      correctIndex: 0,
      successMsg: 'Correct. Staying on the trail prevents more erosion and habitat damage.',
      failMsg: 'Incorrect. Going off-trail causes more damage and may hide hazards.'
    },
    {
      prompt: 'What should hikers do when trail conditions worsen?',
      options: [
        'Turn back or stay on the marked route',
        'Follow animal tracks around the obstacle',
        'Make a wider path so others can pass'
      ],
      correctIndex: 0,
      successMsg: 'Correct. Hikers should stay on the marked route or turn back if needed.',
      failMsg: 'Unsafe choice. Visitors should not create new paths around hazards.'
    }
  ],
  lake: [
    {
      prompt: 'A visitor is feeding bread to ducks. What should the ranger say?',
      options: [
        'Feeding wildlife is prohibited — it harms the animals',
        'Only small amounts of bread are okay',
        'Check if the ducks are native species first'
      ],
      correctIndex: 0,
      successMsg: 'Correct. All wildlife feeding is prohibited in Yellowstone — it disrupts natural behavior and creates dangerous habituation.',
      failMsg: 'Wrong. No amount of human food is safe for wildlife in Yellowstone. All feeding is prohibited.'
    },
    {
      prompt: 'Why is feeding wildlife near Yellowstone Lake so dangerous?',
      options: [
        'It habituates animals to humans — leading to aggression and euthanasia',
        'The birds might fly away and leave the ecosystem',
        'Human food only affects introduced species, not native ones'
      ],
      correctIndex: 0,
      successMsg: 'Correct. A habituated animal loses its fear of humans and often must be put down for public safety.',
      failMsg: 'Incorrect. Feeding any wildlife — native or otherwise — causes habituation and can ultimately cost the animal its life.'
    },
    {
      prompt: 'What is the correct action when a visitor offers food to wildlife?',
      options: [
        'Intervene immediately and confiscate the food',
        'Wait to see if the animal accepts it',
        'Allow it if the animal approached the visitor first'
      ],
      correctIndex: 0,
      successMsg: 'Correct. Rangers must act immediately — any feeding, regardless of who initiated it, is a federal violation in a National Park.',
      failMsg: 'Incorrect. Rangers must intervene at once. Feeding wildlife is a federal offense in all National Parks.'
    }
  ]
};

// ─── POINTS CONSTANTS ───────────────────────────────────────
const PTS = {
  clickVisitor:   +15,
  clickTrash:     +10,
  dragSign:       +20,
  dragFood:       +15,
  extinguishFire: +20,
  wrongClick:     -5,
  sceneBonus:     +25,
  repairBarrier:  +10,
  clearRoad:      +10,
  citePet:        +15,
  markErosion:    +10,
  removeWeed:     +10
};

// ─── BADGE DEFINITIONS ──────────────────────────────────────
const BADGES = {
  geyser: { id:'badge-geyser', name:'Thermal Area Protector', icon:'♨️' },
  bison:  { id:'badge-bison',  name:'Wildlife Distance Keeper', icon:'🐂' },
  camp:   { id:'badge-camp',   name:'Camp Safety Ranger', icon:'🏕️' },
  trail:  { id:'badge-trail',  name:'Trail Guardian', icon:'🌲' },
  lake:   { id:'badge-lake',   name:'Lake Guardian', icon:'🦅' }
};

// ─── RANGER TIPS ────────────────────────────────────────────
const RANGER_TIPS = [
  "Yellowstone's geysers and hot springs are extremely dangerous. Never step off the boardwalk!",
  "Never approach bison within 25 yards. They can run 35 mph — faster than a horse!",
  "Always store food in bear-resistant containers. A fed bear is a dead bear.",
  "Stay on marked trails to protect fragile plant communities and avoid wildlife habitat damage.",
  "Yellowstone is home to over half of the world's geysers.",
  "Pack it in, pack it out — leave no trace in the wilderness.",
  "Feeding wildlife is illegal in Yellowstone. It harms animals and creates dangerous habituation.",
  "Yellowstone Lake reaches depths of 400 feet and surface temperatures near freezing — never swim in it!"
];

// ─── SCREEN MANAGEMENT ──────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const isScene = ['geyser-screen','bison-screen','camp-screen','trail-screen','lake-screen'].includes(id);
  const hud = document.getElementById('hud');
  if (isScene) {
    hud.classList.add('visible');
    updateHUD();
  } else {
    hud.classList.remove('visible');
  }
}

// ─── HUD UPDATE ─────────────────────────────────────────────
function updateHUD() {
  document.getElementById('hud-score').textContent = state.score;
  document.getElementById('hud-zones').textContent = `${state.completedZones.length}/5`;
  const healthPct = Math.max(0, Math.min(100, state.parkHealth));
  document.getElementById('health-bar-fill').style.width = healthPct + '%';
  const sceneName = {geyser:'♨️ Geyser Basin',bison:'🐂 Bison Meadow',camp:'⛺ Campground',trail:'🌲 Forest Trail',lake:'🦅 Yellowstone Lake'};
  document.getElementById('hud-scene-name').textContent = sceneName[state.currentScene] || '';
}

function updateMapUI() {
  document.getElementById('map-score').textContent = state.score;
  document.getElementById('map-zones').textContent = `${state.completedZones.length} / 5`;
  document.getElementById('map-badges').textContent = state.badges.length;
  const hp = Math.max(0, Math.min(100, state.parkHealth));
  document.getElementById('map-health-fill').style.width = hp + '%';

  // Mark completed zone buttons
  state.completedZones.forEach(zone => {
    const btn = document.getElementById(`zone-${zone}`);
    if (btn) btn.classList.add('done');
  });
  // Show earned badges
  state.badges.forEach(zone => {
    const chip = document.getElementById(`badge-${zone}`);
    if (chip) chip.classList.add('earned');
  });
}

// ============================================================
//  STORY SCREEN & MISSION BRIEFING SYSTEM
// ============================================================

function goToMap() {
  updateMapUI();
  showScreen('map-screen');
  updateHomeButtons();
}

let _pendingScene = null;
let _briefingReturnScene = null;
let _resetCampDogOnBriefingReturn = false;

const BRIEFINGS = {
  geyser: {
    icon:  '🌋',
    title: 'Geyser Basin — Thermal Alert',
    sub:   'Old Faithful active · Boardwalk breach reported',
    body:  'Old Faithful is entering an eruption cycle. Three tourists have bypassed the safety boardwalk and are dangerously close to thermal pools — surface temperature: 204°F.\n\nLitter spotted near sensitive geothermal features. Remove all food waste before the next eruption.',
    radio: "Those springs have dissolved people before, Alex. Get those civilians BACK on the boardwalk. Don't wait — MOVE."
  },
  bison: {
    icon:  '🐂',
    title: 'Bison Meadow — Herd Disturbance',
    sub:   'Active herd · Visitor intrusion · Food attractants found',
    body:  'A bison herd of 12 is grazing 30 meters from the road. Multiple visitors have left their vehicles for close-range photos. Food attractants have been spotted — this makes the herd dangerously unpredictable.\n\nBison run at 35 mph. This can escalate in seconds.',
    radio: "Bison have flipped sedans before. If they charge, nothing stops them. Get every one of those visitors BEHIND the barrier line — right now."
  },
  camp: {
    icon:  '⛺',
    title: 'Campground Alpha — Multiple Violations',
    sub:   'Illegal fires · Unsecured food · Bear sighting 200m east',
    body:  'Night patrol logged 5 violations: unsecured food, illegal campfires, water taps running, and noise after quiet hours. Worse — a black bear was spotted 200 meters east, tracking the food smell toward camp.\n\nEvery second you wait, it gets closer.',
    radio: "That bear picked up a scent and it's heading in. Get the food secured before it arrives. A fed bear doesn't survive the season — and neither does a careless ranger."
  },
  trail: {
    icon:  '🌲',
    title: 'North Forest Trail — Emergency',
    sub:   'Post-rain trail damage · Missing hikers · Invasive species',
    body:  "Last night's rain destabilized sections of Trail 4. One hiker has wandered off the marked path. An invasive plant species was photographed near marker 7. An illegal mountain biker was also reported heading north.",
    radio: "You've held this park together through four crises already. Don't lose focus now — finish what you started. The park is counting on you."
  },
  lake: {
    icon:  '🦅',
    title: 'Yellowstone Lake — Wildlife Feeding Alert',
    sub:   'Multiple feeding violations · Wildlife habituation risk',
    body:  "Multiple visitors have been spotted feeding waterfowl and ground squirrels along the south shore of Yellowstone Lake. Food attractants are scattered near the waterline, drawing wildlife dangerously close to the public.\n\nFeeding wildlife is illegal in Yellowstone — it leads to habituation, disease spread, and animals that must be euthanized. Confiscate all food and redirect every violator.",
    radio: "A fed animal is a dead animal, Alex. Every piece of bread tossed into that lake is a death sentence for those birds. Clear the shore — now."
  }
};

function showBriefing(scene) {
  const d = BRIEFINGS[scene];
  if (!d) { actuallyGoToScene(scene); return; }
  _pendingScene = scene;
  document.getElementById('briefing-icon').textContent      = d.icon;
  document.getElementById('briefing-title').textContent     = d.title;
  document.getElementById('briefing-sub').textContent       = d.sub;
  document.getElementById('briefing-body').textContent      = d.body;
  document.getElementById('briefing-radio-msg').textContent = d.radio;
  const btn = document.querySelector('#briefing-screen .btn');
  if (btn) btn.textContent = _briefingReturnScene ? '▶ Resume Patrol' : '⚡ Mission Start';
  showScreen('briefing-screen');
}

function dismissBriefing() {
  if (_rereadMode) {
    _rereadMode = false;
    resumeGame();
    return;
  }
  if (_briefingReturnScene) {
    const returnScene = _briefingReturnScene;
    _briefingReturnScene = null;
    _pendingScene = returnScene;
    if (returnScene === 'camp' && _resetCampDogOnBriefingReturn) {
      _resetCampDogToEntrance(true);
      _resetCampDogOnBriefingReturn = false;
    }
    resumeCurrentScene();
    return;
  }
  if (_pendingScene) actuallyGoToScene(_pendingScene);
}

// ─── DIALOGUE BUBBLE SYSTEM ─────────────────────────────────

function showDialogueBubble(x, y, text, areaId, isRadio, duration) {
  const dur = duration || 2800;
  const area = document.getElementById(areaId);
  if (!area) return;
  const b = document.createElement('div');
  b.className = 'dialogue-bubble' + (isRadio ? ' radio-bubble' : '');
  b.textContent = text;
  b.style.left = Math.max(4, Math.min(x, 660)) + 'px';
  b.style.top  = Math.max(4, y) + 'px';
  area.appendChild(b);
  setTimeout(() => { if (b.parentNode) b.parentNode.removeChild(b); }, dur + 100);
}

// ─── GAME START ─────────────────────────────────────────────
function startGame() {
  // Reset state in case of replay
  state.score = 0;
  state.parkHealth = 100;
  state.completedZones = [];
  state.badges = [];
  state.currentScene = null;
  state.pausedScene = null;
  // Reset all scene states
  state.scenes.geyser = { visitorCount:0, visitorTotal:2, signDone:false, trashCount:0, trashTotal:5, ropeFixed:0, ropeTotal:2, briefingDone:false, complete:false };
  state.scenes.bison  = { visitorsFixed:0, visitorsTotal:3, foodRemoved:0, foodTotal:5, signDone:false, roadCleared:0, roadTotal:2, briefingDone:false, complete:false };
  state.scenes.camp   = { foodStored:0, foodTotal:5, trashRemoved:0, trashTotal:3, fireDone:false, fire2Done:false, petCited:false, bearPenaltyGiven:false, briefingDone:false, complete:false };
  state.scenes.trail  = { visitorsFixed:0, visitorsTotal:2, obstaclesCleared:0, obstaclesTotal:3, litterRemoved:0, litterTotal:2, signDone:false, erosionMarked:0, erosionTotal:2, briefingDone:false, complete:false };
  state.scenes.lake   = { visitorsFixed:0, visitorsTotal:3, foodRemoved:0, foodTotal:4, signDone:false, weedsRemoved:0, weedTotal:3, briefingDone:false, complete:false };
  state.runtime.geyser = createRuntimeState('geyser');
  state.runtime.bison  = createRuntimeState('bison');
  state.runtime.camp   = createRuntimeState('camp');
  state.runtime.trail  = createRuntimeState('trail');
  state.runtime.lake   = createRuntimeState('lake');
  state.questionSet.geyser = null;
  state.questionSet.bison  = null;
  state.questionSet.camp   = null;
  state.questionSet.trail  = null;
  state.questionSet.lake   = null;

  resetAllScenes();
  updateMapUI();
  updateHomeButtons();
  showScreen('story-screen');
}

function restartGame() {
  startGame();
}

function hasSavedProgress() {
  return state.completedZones.length > 0 || Object.values(state.runtime).some(rt => rt.started);
}

function updateHomeButtons() {
  const btn = document.getElementById('continue-patrol-btn');
  if (!btn) return;
  btn.hidden = !hasSavedProgress();
}

function continueFromHome() {
  if (state.pausedScene && !state.scenes[state.pausedScene].complete) {
    state.currentScene = state.pausedScene;
    resumeCurrentScene();
    return;
  }
  updateMapUI();
  showScreen('map-screen');
}

// ─── RESET VISUAL ELEMENTS FOR ALL SCENES ───────────────────
function resetAllScenes() {
  stopAllTimers();
  state.pausedScene = null;
  // Show all interactive elements again
  const ids = [
    // Geyser
    'g-visitor','g-visitor2','g-sign','g-trash1','g-trash2','g-trash3','g-trash4','g-trash5','g-decoy','g-vent',
    // Bison
    'b-visitor1','b-visitor2','b-visitor3','b-food1','b-food2','b-food3','b-food4','b-food5','b-sign','b-rock','b-flower',
    // Camp
    'c-food1','c-food2','c-food3','c-food4','c-food5','c-trash1','c-trash2','c-trash3','c-gear','c-fire2-obj',
    // Trail
    't-visitor','t-visitor2','t-branch','t-rock','t-stump','t-litter1','t-litter2','t-sign','t-squirrel','t-deer','g-visitor3','b-food6','b-food7',
    'g-selfie','g-collector','b-drone','b-feeder','c-noise','c-water','c-car','t-biker','t-invasive','t-injured',
    // Lake
    'l-visitor1','l-visitor2','l-visitor3','l-food1','l-food2','l-food3','l-food4','l-sign','l-decoy1','l-fish','l-wade','l-fish-rod',
    'l-weed1','l-weed2','l-weed3',
    // New ranger tasks
    'g-rope1','g-rope2','b-car1','b-car2','c-dog','t-erosion1','t-erosion2'
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('done','dragging');
      el.style.opacity = '';
      el.style.display = '';
      el.style.pointerEvents = '';
    }
  });

  // Reset drop zones
  ['g-sign-drop','b-sign-drop','camp-locker-drop','t-sign-drop','l-sign-drop'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('filled','highlight');
  });

  // Reset campfire
  const flame = document.getElementById('c-fire-flame');
  if (flame) { flame.textContent = '🔥'; flame.classList.remove('out'); }
  const fireObj = document.getElementById('c-fire-obj');
  if (fireObj) fireObj.style.pointerEvents = '';

  // Reset 2nd campfire (hide it, reset flame)
  const flame2 = document.getElementById('c-fire2-flame');
  if (flame2) { flame2.textContent = '🔥'; flame2.classList.remove('out'); }
  const fireObj2 = document.getElementById('c-fire2-obj');
  if (fireObj2) { fireObj2.style.pointerEvents = ''; fireObj2.style.display = 'none'; }

  // Reset bear warning
  const bear = document.getElementById('bear-warn');
  if (bear) { bear.style.opacity = '0'; bear.style.right = '-60px'; }

  // Reset camp dog patrol
  stopCampDogPatrol(true);
  if (state.runtime.camp) state.runtime.camp.dogPatrolPrimed = false;

  // Reset overlays
  ['geyser-complete','bison-complete','camp-complete','trail-complete','lake-complete'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('visible');
  });
  ['geyser-screen','bison-screen','camp-screen','trail-screen','lake-screen'].forEach(id => {
    const screen = document.getElementById(id);
    if (screen) screen.classList.remove('paused');
  });
  ['geyser-pause-overlay','bison-pause-overlay','camp-pause-overlay','trail-pause-overlay','lake-pause-overlay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('visible');
  });

  // Reset zone buttons
  ['geyser','bison','camp','trail','lake'].forEach(zone => {
    const btn = document.getElementById(`zone-${zone}`);
    if (btn) btn.classList.remove('done');
  });

  // Reset badge chips
  ['badge-geyser','badge-bison','badge-camp','badge-trail','badge-lake'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('earned');
  });

  // Reset task labels
  resetTaskLabels();

  // Restore drag positions for draggables (reset inline styles)
  resetDraggablePositions();

  // Restore scene footers (hidden on scene complete)
  document.querySelectorAll('.scene-footer').forEach(f => f.style.display = '');

  stopRangerEvents();
  stopCampFire2(true);
  // Reset wave-2 spawn flag
  bisonWave2Spawned = false;
  state.runtime.geyser = createRuntimeState('geyser');
  state.runtime.bison  = createRuntimeState('bison');
  state.runtime.camp   = createRuntimeState('camp');
  state.runtime.trail  = createRuntimeState('trail');
  state.runtime.lake   = createRuntimeState('lake');
  state.questionSet.geyser = null;
  state.questionSet.bison  = null;
  state.questionSet.camp   = null;
  state.questionSet.trail  = null;
  state.questionSet.lake   = null;
  renderAllSceneQuestions();
  updatePauseButtons();
}

function resetTaskLabels() {
  // Geyser
  setTaskText('task-g-visitor', 'Redirect visitors off boardwalk (0/2)');
  setTaskText('task-g-trash', 'Clean up all litter (0/5)');
  setTaskText('task-g-rope', 'Repair fallen barrier ropes (0/2)');
  setTaskText('task-g-brief', 'Choose the right thermal safety message');
  // Bison
  setTaskText('task-b-visitors', 'Redirect visitors near bison (0/3)');
  setTaskText('task-b-food', 'Remove food attractants (0/5)');
  setTaskText('task-b-road', 'Clear road for bison crossing (0/2)');
  setTaskText('task-b-brief', 'Answer the wildlife safety question');
  // Camp
  setTaskText('task-c-food', 'Store food in bear locker (0/5)');
  setTaskText('task-c-trash', 'Remove camp trash (0/3)');
  setTaskText('task-c-pet', 'Cite pet leash violation (0/1)');
  setTaskText('task-c-brief', 'Give campers the correct bear advice');
  // Trail
  setTaskText('task-t-visitor', 'Redirect hikers back to trail (0/2)');
  setTaskText('task-t-obstacles', 'Clear trail obstacles (0/3)');
  setTaskText('task-t-litter', 'Pick up trail litter (0/2)');
  setTaskText('task-t-erosion', 'Document trail erosion (0/2)');
  setTaskText('task-t-brief', 'Choose the right trail safety advice');
  // Lake
  setTaskText('task-l-visitors', 'Stop visitors feeding wildlife (0/3)');
  setTaskText('task-l-food', 'Remove food attractants (0/4)');
  setTaskText('task-l-weeds', 'Remove invasive plants (0/3)');
  // Clear all done classes
  document.querySelectorAll('.task-item').forEach(t => t.classList.remove('done'));
  document.querySelectorAll('.choice-option').forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('done');
  });
}

function chooseRandomQuestion(scene) {
  const bank = QUESTION_BANKS[scene] || [];
  if (!bank.length) return null;
  const picked = bank[Math.floor(Math.random() * bank.length)];
  return {
    prompt: picked.prompt,
    options: [...picked.options],
    correctIndex: picked.correctIndex,
    successMsg: picked.successMsg,
    failMsg: picked.failMsg
  };
}

function ensureSceneQuestion(scene) {
  if (!state.questionSet[scene]) state.questionSet[scene] = chooseRandomQuestion(scene);
  return state.questionSet[scene];
}

function renderSceneQuestion(scene) {
  const q = ensureSceneQuestion(scene);
  const qEl = document.getElementById(`choice-${scene}-question`);
  const oEl = document.getElementById(`choice-${scene}-options`);
  if (!q || !qEl || !oEl) return;

  qEl.textContent = q.prompt;
  oEl.innerHTML = '';
  q.options.forEach((option, idx) => {
    const btn = document.createElement('button');
    btn.className = 'choice-option';
    btn.textContent = option;
    btn.onclick = () => handleSceneChoice(scene, idx);
    if (state.scenes[scene].briefingDone) {
      btn.disabled = true;
      btn.classList.add('done');
    }
    oEl.appendChild(btn);
  });
}

function renderAllSceneQuestions() {
  ['geyser','bison','camp','trail','lake'].forEach(scene => renderSceneQuestion(scene));
}

function setTaskText(id, text) {
  const el = document.getElementById(id);
  if (el) {
    // Preserve the dot div
    const dot = el.querySelector('.task-dot');
    el.innerHTML = '';
    if (dot) el.appendChild(dot);
    el.appendChild(document.createTextNode(text));
  }
}

function resetDraggablePositions() {
  const defaultPositions = {
    // Geyser sign
    'g-sign':  { top:'180px', right:'60px',  left:'',     bottom:'' },
    // Bison sign
    'b-sign':  { bottom:'80px', left:'50px', top:'',      right:'' },
    // Camp food — spread layout (matches current HTML positions)
    'c-food5': { left:'267px', top:'147px',  bottom:'',   right:'' },
    'c-food1': { left:'302px', top:'143px',  bottom:'',   right:'' },
    'c-food3': { left:'335px', top:'148px',  bottom:'',   right:'' },
    'c-food2': { left:'370px', top:'142px',  bottom:'',   right:'' },
    'c-food4': { left:'404px', top:'147px',  bottom:'',   right:'' },
    // Trail sign
    't-sign':  { top:'270px',  right:'78px', left:'',     bottom:'' },
    // Lake sign
    'l-sign':  { top:'138px',  right:'52px', left:'',     bottom:'' }
  };
  Object.entries(defaultPositions).forEach(([id, pos]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.top    = pos.top    || '';
    el.style.right  = pos.right  || '';
    el.style.bottom = pos.bottom || '';
    el.style.left   = pos.left   || '';
  });
}

function updatePauseButtons() {
  ['geyser','bison','camp','trail','lake'].forEach(scene => {
    const btn = document.getElementById(`${scene}-pause-btn`);
    if (!btn) return;
    btn.textContent = state.pausedScene === scene ? 'resume' : 'pause';
  });
}

function getSceneScreenId(scene) {
  return `${scene}-screen`;
}

function getPauseOverlayId(scene) {
  return `${scene}-pause-overlay`;
}

function cancelActiveDrag() {
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  document.removeEventListener('touchmove', onDragMoveTouch);
  document.removeEventListener('touchend', onDragEndTouch);
  if (dragEl) dragEl.classList.remove('dragging');
  if (activeDrag) {
    const dropZone = document.getElementById(activeDrag.dropId);
    if (dropZone) dropZone.classList.remove('highlight');
  }
  activeDrag = null;
  dragEl = null;
}

function suspendCurrentScene(showOverlay = true) {
  const scene = state.currentScene;
  if (!scene || state.scenes[scene].complete) return;
  cancelActiveDrag();
  state.runtime[scene].sceneTimeLeft = sceneTimeLeft;
  // Save remaining time for all active setTimeout-based timers
  const _rt = state.runtime[scene];
  if (scene === 'camp') {
    if (bearStartTimeout)    _rt.bearStartRemaining    = Math.max(200, 3000 - (Date.now() - _bearStartAt));
    if (raccoonRushTimeout)  _rt.raccoonRushRemaining  = Math.max(200, 9000 - (Date.now() - _raccoonRushAt));
    if (campFire2Timeout)    _rt.campFire2Remaining    = Math.max(200, 8000 - (Date.now() - _campFire2At));
  }
  if (scene === 'trail') {
    if (movingVisitorStartTimeout) _rt.movingVisitorStartRemaining = Math.max(200, 4000 - (Date.now() - _movingVisitorStartAt));
  }
  if (scene === 'geyser') {
    if (geyserVisitor3Timeout) _rt.visitor3Remaining = Math.max(200, 12000 - (Date.now() - _geyserVisitor3At));
  }
  if (scene === 'bison') {
    _rt.bisonChargeSeconds = bisonChargeSeconds;
  }
  stopAllTimers();
  state.pausedScene = scene;
  const screen = document.getElementById(getSceneScreenId(scene));
  const overlay = document.getElementById(getPauseOverlayId(scene));
  if (screen) screen.classList.add('paused');
  if (overlay) overlay.classList.toggle('visible', showOverlay);
  updatePauseButtons();
  updateHomeButtons();
}

function resumeSceneSystems(scene) {
  const runtime = state.runtime[scene];
  startSceneTimer(scene, runtime.sceneTimeLeft);

  if (scene === 'geyser') {
    startEruptionCycle();
    if (runtime.visitor3Pending) {
      scheduleGeyserVisitor3(runtime.visitor3Remaining || 12000);
      runtime.visitor3Remaining = null;
    }
  }
  if (scene === 'bison') {
    if (state.scenes.bison.visitorsFixed < state.scenes.bison.visitorsTotal)
      startBisonChargeTimer(runtime.bisonChargeSeconds || 0);
  }
  if (scene === 'camp') {
    if (!state.scenes.camp.bearPenaltyGiven && !state.scenes.camp.complete && state.scenes.camp.foodStored < state.scenes.camp.foodTotal) {
      scheduleBearTimerStart(runtime.bearStartRemaining || 3000);
      runtime.bearStartRemaining = null;
    }
    const dog = document.getElementById('c-dog');
    if (dog && !dog.classList.contains('done')) startCampDogPatrol();
    startRaccoonRush(runtime.raccoonRushRemaining || 9000);
    runtime.raccoonRushRemaining = null;
    if (runtime.campFire2Pending) {
      scheduleCampFire2(runtime.campFire2Remaining || 8000);
      runtime.campFire2Remaining = null;
    }
  }
  if (scene === 'trail') {
    const movingVisitor = document.getElementById('t-visitor2');
    if (movingVisitor && !movingVisitor.classList.contains('done')) {
      scheduleMovingVisitorStart(runtime.movingVisitorStartRemaining || 4000);
      runtime.movingVisitorStartRemaining = null;
    }
    startMudslideTimer();
  }

  Object.entries(runtime.rangerEvents || {}).forEach(([id, delay]) => {
    if (delay > 0) scheduleRangerEvent(delay, id, scene);
  });
}

function resumeCurrentScene() {
  const scene = state.currentScene || state.pausedScene;
  if (!scene || state.scenes[scene].complete) return;
  if (scene === 'camp' && _resetCampDogOnBriefingReturn) {
    _resetCampDogToEntrance(true);
    _resetCampDogOnBriefingReturn = false;
  }
  state.currentScene = scene;
  state.pausedScene = null;
  _briefingReturnScene = null;
  const screenId = getSceneScreenId(scene);
  const overlay = document.getElementById(getPauseOverlayId(scene));
  const screen = document.getElementById(screenId);
  if (overlay) overlay.classList.remove('visible');
  if (screen) screen.classList.remove('paused');
  showScreen(screenId);
  initDragAndDrop(scene);
  resumeSceneSystems(scene);
  updatePauseButtons();
  updateHomeButtons();
}

function togglePauseCurrentScene() {
  const scene = state.currentScene;
  if (!scene || state.scenes[scene].complete) return;
  if (state.pausedScene === scene) resumeCurrentScene();
  else suspendCurrentScene(true);
}

function leaveSceneToMap() {
  if (state.currentScene && !state.scenes[state.currentScene].complete) suspendCurrentScene(false);
  updateMapUI();
  showScreen('map-screen');
  updateHomeButtons();
}

function leaveSceneToHome() {
  if (state.currentScene && !state.scenes[state.currentScene].complete) suspendCurrentScene(false);
  showScreen('start-screen');
  updateHomeButtons();
}

function reviewCurrentMission() {
  const scene = state.currentScene || state.pausedScene;
  if (!scene || state.scenes[scene].complete) return;
  if (state.pausedScene !== scene) suspendCurrentScene(false);
  _briefingReturnScene = scene;
  _pendingScene = scene;
  _resetCampDogOnBriefingReturn = scene === 'camp';
  if (scene === 'camp') {
    const dog = document.getElementById('c-dog');
    if (dog) dog.style.display = 'none';
  }
  showBriefing(scene);
}

let bearStartTimeout = null;
let _bearStartAt = 0;
function scheduleBearTimerStart(delay) {
  const d = (typeof delay === 'number') ? delay : 3000;
  clearTimeout(bearStartTimeout);
  _bearStartAt = Date.now();
  bearStartTimeout = setTimeout(() => {
    bearStartTimeout = null;
    if (state.currentScene === 'camp' && !state.scenes.camp.complete) startBearTimer();
  }, d);
}

let movingVisitorStartTimeout = null;
let _movingVisitorStartAt = 0;
function scheduleMovingVisitorStart(delay) {
  const d = (typeof delay === 'number') ? delay : 4000;
  clearTimeout(movingVisitorStartTimeout);
  _movingVisitorStartAt = Date.now();
  movingVisitorStartTimeout = setTimeout(() => {
    movingVisitorStartTimeout = null;
    if (state.currentScene === 'trail' && !state.scenes.trail.complete) startMovingVisitor();
  }, d);
}

// ============================================================
//  SCENE COUNTDOWN TIMER SYSTEM
// ============================================================
const SCENE_TIME_LIMITS = { geyser: 58, bison: 50, camp: 42, trail: 55, lake: 52 };
let sceneTimerInterval = null;
let sceneTimeLeft      = 0;

function startSceneTimer(scene, initialTimeLeft) {
  stopSceneTimer();
  sceneTimeLeft = typeof initialTimeLeft === 'number' ? initialTimeLeft : (SCENE_TIME_LIMITS[scene] || 60);
  state.runtime[scene].sceneTimeLeft = sceneTimeLeft;
  const timerGroup = document.getElementById('hud-timer-group');
  if (timerGroup) timerGroup.style.display = 'flex';
  _renderTimer();
  sceneTimerInterval = setInterval(() => {
    if (gamePaused) return;
    if (state.scenes[scene] && state.scenes[scene].complete) { stopSceneTimer(); return; }
    sceneTimeLeft--;
    state.runtime[scene].sceneTimeLeft = sceneTimeLeft;
    _renderTimer();
    if (sceneTimeLeft <= 0) {
      stopSceneTimer();
      _handleTimerExpiry(scene);
    }
  }, 1000);
}

function stopSceneTimer() {
  clearInterval(sceneTimerInterval);
  sceneTimerInterval = null;
  const timerEl    = document.getElementById('hud-timer');
  const timerGroup = document.getElementById('hud-timer-group');
  if (timerEl)    { timerEl.textContent = '--'; timerEl.classList.remove('urgent'); }
  if (timerGroup) timerGroup.style.display = 'none';
}

function _renderTimer() {
  const el = document.getElementById('hud-timer');
  if (!el) return;
  el.textContent = sceneTimeLeft + 's';
  if (sceneTimeLeft <= 12) el.classList.add('urgent');
  else el.classList.remove('urgent');
}

function _handleTimerExpiry(scene) {
  const sc = state.scenes[scene];
  if (!sc || sc.complete) return;
  const penalty = -15;
  addScore(penalty);
  state.parkHealth = Math.max(0, state.parkHealth - 8);
  updateHUD();
  setFeedback(scene + '-feedback', `⏰ Time\'s up! Zone unsecured. (${penalty} pts, -8 health)`, 'bad');
}

// ============================================================
//  GEYSER: OLD FAITHFUL ERUPTION SYSTEM
// ============================================================
let eruptionTimeout = null;

function startEruptionCycle() {
  stopEruptionCycle();
  // First eruption after 6s
  eruptionTimeout = setTimeout(_triggerEruption, 6000);
}

function stopEruptionCycle() {
  clearTimeout(eruptionTimeout);
  eruptionTimeout = null;
  const overlay = document.getElementById('g-eruption-overlay');
  if (overlay) overlay.style.display = 'none';
}

function _triggerEruption() {
  if (state.scenes.geyser.complete) return;
  const overlay = document.getElementById('g-eruption-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    showDialogueBubble(255, 52, '♨️ Old Faithful is ERUPTING! Clear the area!', 'geyser-area', true, 2100);
    overlay.style.animation = 'none';
    // Force reflow then re-apply animation
    void overlay.offsetWidth;
    overlay.style.animation = 'eruptionFade 2.2s ease-out forwards';
    setTimeout(() => { if (overlay) overlay.style.display = 'none'; }, 2200);
  }
  setFeedback('geyser-feedback', '♨️ Old Faithful erupting! Can\'t see anything for 2s!', 'bad');
  // Schedule next eruption every 10s
  eruptionTimeout = setTimeout(_triggerEruption, 10000);
}

// ============================================================
//  BISON: CHARGE PENALTY SYSTEM
// ============================================================
let bisonChargeInterval = null;
let bisonChargeSeconds  = 0;
const BISON_CHARGE_SECONDS = 9;

function startBisonChargeTimer(initialSeconds) {
  stopBisonChargeTimer();
  bisonChargeSeconds = (typeof initialSeconds === 'number') ? initialSeconds : 0;
  const barWrap = document.getElementById('bison-charge-bar-wrap');
  if (barWrap) barWrap.style.display = 'flex';
  _renderBisonChargeBar();
  bisonChargeInterval = setInterval(() => {
    if (gamePaused) return;
    if (state.scenes.bison.complete) { stopBisonChargeTimer(); return; }
    bisonChargeSeconds++;
    _renderBisonChargeBar();
    // Each time a visitor is fixed, reset the timer
    if (bisonChargeSeconds >= BISON_CHARGE_SECONDS) {
      stopBisonChargeTimer();
      _triggerBisonCharge();
    }
  }, 1000);
}

function _renderBisonChargeBar() {
  const fill      = document.getElementById('bison-charge-bar-fill');
  const countdown = document.getElementById('bison-charge-countdown');
  const remaining = Math.max(0, BISON_CHARGE_SECONDS - bisonChargeSeconds);
  if (fill)      fill.style.width = (remaining / BISON_CHARGE_SECONDS * 100) + '%';
  if (countdown) countdown.textContent = remaining + 's';
}

function resetBisonChargeTimer() {
  // Called each time a visitor is safely redirected
  bisonChargeSeconds = 0;
  _renderBisonChargeBar();
}

function stopBisonChargeTimer() {
  clearInterval(bisonChargeInterval);
  bisonChargeInterval = null;
  const barWrap = document.getElementById('bison-charge-bar-wrap');
  if (barWrap) barWrap.style.display = 'none';
}

function _triggerBisonCharge() {
  const sc = state.scenes.bison;
  const remaining = sc.visitorsTotal - sc.visitorsFixed;
  if (remaining <= 0) return; // all visitors already safe

  const penalty = remaining * -12;
  addScore(penalty);

  // Force-complete remaining visitors (they fled the charge)
  ['b-visitor1','b-visitor2','b-visitor3'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.classList.contains('done')) {
      el.classList.add('done');
      sc.visitorsFixed++;
    }
  });
  updateTaskCounter('task-b-visitors', `Redirect visitors near bison (${sc.visitorsFixed}/${sc.visitorsTotal})`);
  if (sc.visitorsFixed >= sc.visitorsTotal) markTaskDone('task-b-visitors');

  // Flash charge overlay
  const overlay = document.getElementById('bison-charge-overlay');
  const sub     = document.getElementById('bison-charge-sub');
  if (sub) sub.textContent = `${remaining} visitor(s) too slow — ${Math.abs(penalty)} pts lost!`;
  if (overlay) {
    overlay.style.display = 'flex';
    setTimeout(() => { if (overlay) overlay.style.display = 'none'; }, 1400);
  }
  setFeedback('bison-feedback', `🐂 BISON CHARGED! ${remaining} visitor(s) not moved in time. (${penalty} pts)`, 'bad');
  showDialogueBubble(195, 38, '📻 Martinez: "BISON CHARGING! EVERYONE BACK NOW!"', 'bison-area', true, 3000);

  // Restart timer (bison calms, visitors come back for another round...)
  if (!sc.complete) startBisonChargeTimer();
  checkBisonComplete();
}

// ============================================================
//  CAMP: RACCOON RUSH SYSTEM
// ============================================================
let raccoonRushTimeout = null;
let _raccoonRushAt = 0;

function startRaccoonRush(delay) {
  const d = (typeof delay === 'number') ? delay : 9000;
  _raccoonRushAt = Date.now();
  raccoonRushTimeout = setTimeout(() => {
    const sc = state.scenes.camp;
    if (sc.complete) return;
    const raccoon = document.getElementById('camp-raccoon');
    if (!raccoon) return;
    raccoon.style.display = 'block';
    const foodLeft = sc.foodTotal - sc.foodStored;
    if (foodLeft > 0) {
      // Raccoon rushes to food — animate and penalize
      raccoon.style.animation = `raccoonRush ${3}s linear forwards`;
      raccoon.style.animationDuration = '3s';
      setTimeout(() => {
        const sc2 = state.scenes.camp;
        if (!sc2.complete && sc2.foodStored < sc2.foodTotal) {
          const stolen = Math.min(2, sc2.foodTotal - sc2.foodStored);
          addScore(stolen * -8);
          setFeedback('camp-feedback', `🐾 Raccoon stole ${stolen} food item(s)! (${stolen * -8} pts)`, 'bad');
        }
        if (raccoon) raccoon.style.display = 'none';
      }, 3200);
    } else {
      raccoon.style.display = 'none';
    }
  }, d); // raccoon appears d ms into the scene
}

function stopRaccoonRush() {
  clearTimeout(raccoonRushTimeout);
  raccoonRushTimeout = null;
  const raccoon = document.getElementById('camp-raccoon');
  if (raccoon) { raccoon.style.display = 'none'; raccoon.style.animation = ''; }
}

// ============================================================
//  TRAIL: MOVING VISITOR SYSTEM
// ============================================================
let movingVisitorInterval = null;

function startMovingVisitor() {
  const el = document.getElementById('t-visitor2');
  if (!el || el.classList.contains('done')) return;
  // Reset to starting right-side position
  el.style.right  = '';
  el.style.left   = '680px';
  el.style.top    = '185px';
  movingVisitorInterval = setInterval(() => {
    if (gamePaused) return;
    if (el.classList.contains('done')) { clearInterval(movingVisitorInterval); return; }
    const sc = state.scenes.trail;
    if (sc.complete) { clearInterval(movingVisitorInterval); return; }
    const curLeft = parseInt(el.style.left) || 680;
    const newLeft = curLeft - 2.5; // walk left ~2.5px per tick (100ms → faster crossing)
    el.style.left = newLeft + 'px';
    // Visitor exits left boundary without being caught
    if (newLeft < -60) {
      clearInterval(movingVisitorInterval);
      if (!el.classList.contains('done')) {
        el.classList.add('done');
        sc.visitorsFixed++;
        const t = sc.visitorsTotal;
        addScore(-12);
        updateTaskCounter('task-t-visitor', `Redirect hikers back to trail (${sc.visitorsFixed}/${t})`);
        if (sc.visitorsFixed >= t) markTaskDone('task-t-visitor');
        setFeedback('trail-feedback', '❌ Hiker walked off the trail unnoticed! (-12 pts)', 'bad');
        checkTrailComplete();
      }
    }
  }, 100);
}

function stopMovingVisitor() {
  clearInterval(movingVisitorInterval);
  movingVisitorInterval = null;
}

// ============================================================
//  RANGER EVENTS — bonus clickable surprises per scene
// ============================================================
const _rangerEventTimeouts = [];

function scheduleRangerEvent(delayMs, id, scene) {
  const ownerScene = scene || state.currentScene;
  const startedAt = Date.now();
  const t = setTimeout(() => {
    const el = document.getElementById(id);
    if (el && !el.classList.contains('done')) {
      el.style.display = 'flex';
    }
    if (ownerScene && state.runtime[ownerScene]) delete state.runtime[ownerScene].rangerEvents[id];
  }, delayMs);
  _rangerEventTimeouts.push({ id, scene: ownerScene, timeoutId: t, startedAt, delayMs });
}

function stopRangerEvents() {
  const currentScene = state.currentScene || state.pausedScene;
  _rangerEventTimeouts.forEach(evt => {
    clearTimeout(evt.timeoutId);
    if (evt.scene && state.runtime[evt.scene] && state.runtime[evt.scene].rangerEvents[evt.id] > 0) {
      state.runtime[evt.scene].rangerEvents[evt.id] = Math.max(200, evt.delayMs - (Date.now() - evt.startedAt));
    }
  });
  _rangerEventTimeouts.length = 0;
  // Only hide/reset ranger events belonging to the current scene (leave completed scenes untouched)
  if (currentScene) {
    const screenEl = document.getElementById(currentScene + '-screen');
    if (screenEl) {
      screenEl.querySelectorAll('.ranger-event').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('done');
      });
    }
  }
}

function handleRangerBonus(id, pts, feedbackId, msg) {
  const el = document.getElementById(id);
  if (!el || el.classList.contains('done')) return;
  el.classList.add('done');
  addScore(pts);
  const areaMap = {
    'geyser-feedback': 'geyser-area',
    'bison-feedback':  'bison-area',
    'camp-feedback':   'camp-area',
    'trail-feedback':  'trail-area'
  };
  const areaId = areaMap[feedbackId] || 'geyser-area';
  const rect     = el.getBoundingClientRect();
  const areaRect = document.getElementById(areaId).getBoundingClientRect();
  showPointsPopup(rect.left - areaRect.left, rect.top - areaRect.top - 20, pts, areaId);
  setFeedback(feedbackId, msg, 'good');
}

// ============================================================
//  GEYSER: SPAWN 3RD VISITOR AFTER DELAY
// ============================================================
let geyserVisitor3Timeout = null;
let _geyserVisitor3At = 0;
function scheduleGeyserVisitor3(delay) {
  const d = (typeof delay === 'number') ? delay : 12000;
  state.runtime.geyser.visitor3Pending = true;
  _geyserVisitor3At = Date.now();
  geyserVisitor3Timeout = setTimeout(() => {
    const sc = state.scenes.geyser;
    if (sc.complete || state.currentScene !== 'geyser') return;
    const el = document.getElementById('g-visitor3');
    if (!el || el.classList.contains('done')) return;
    el.style.display = '';
    el.classList.add('spawn-pop');
    sc.visitorTotal = 3;
    state.runtime.geyser.visitor3Pending = false;
    updateTaskCounter('task-g-visitor', `Redirect visitors off boardwalk (${sc.visitorCount}/3)`);
    setFeedback('geyser-feedback', '⚠️ Another visitor stepped off the boardwalk!', 'bad');
  }, d);
}
function stopGeyserVisitor3() {
  clearTimeout(geyserVisitor3Timeout);
  geyserVisitor3Timeout = null;
}

// ============================================================
//  BISON: SPAWN WAVE-2 FOOD AFTER FIRST 5 REMOVED
// ============================================================
let bisonWave2Spawned = false;
function checkSpawnBisonWave2() {
  const sc = state.scenes.bison;
  if (bisonWave2Spawned || sc.foodRemoved < 5 || sc.complete) return;
  bisonWave2Spawned = true;
  sc.foodTotal = 7;
  const f6 = document.getElementById('b-food6');
  const f7 = document.getElementById('b-food7');
  if (f6) { f6.style.display = ''; f6.classList.add('spawn-pop'); }
  if (f7) { f7.style.display = ''; f7.classList.add('spawn-pop'); }
  updateTaskCounter('task-b-food', `Remove food attractants (${sc.foodRemoved}/7)`);
  setFeedback('bison-feedback', '🍞 More food dropped! Keep clearing!', 'bad');
}

// ============================================================
//  CAMP: SPAWN 2ND CAMPFIRE AFTER 8s
// ============================================================
let campFire2Timeout = null;
let _campFire2At = 0;
function scheduleCampFire2(delay) {
  const d = (typeof delay === 'number') ? delay : 8000;
  state.runtime.camp.campFire2Pending = true;
  _campFire2At = Date.now();
  campFire2Timeout = setTimeout(() => {
    const sc = state.scenes.camp;
    if (sc.complete || state.currentScene !== 'camp') return;
    const el = document.getElementById('c-fire2-obj');
    if (!el) return;
    el.style.display = '';
    state.runtime.camp.campFire2Pending = false;
    el.classList.add('fire2-spawn-flash');
    setTimeout(() => { if (el) el.classList.remove('fire2-spawn-flash'); }, 700);
    setFeedback('camp-feedback', '🔥 A second fire broke out! Extinguish it fast!', 'bad');
    updateTaskCounter('task-c-fire', 'Extinguish all campfires (0/2)');
  }, d);
}
function stopCampFire2(resetVisual = false) {
  clearTimeout(campFire2Timeout);
  campFire2Timeout = null;
  const el = document.getElementById('c-fire2-obj');
  if (el && resetVisual) el.style.display = 'none';
}

const CAMP_DOG_ENTRANCE = { left: -56, top: 286 };

function _resetCampDogToEntrance(hideUntilMove = false) {
  const dog = document.getElementById('c-dog');
  if (!dog) return;
  dog.classList.remove('camp-dog-running');
  dog.style.display = hideUntilMove ? 'none' : '';
  dog.style.left = `${CAMP_DOG_ENTRANCE.left}px`;
  dog.style.top = `${CAMP_DOG_ENTRANCE.top}px`;
  dog.style.transform = 'translate(0px, 0px)';
  const body = dog.querySelector('.visitor-body');
  if (body) body.style.transform = 'scaleX(-1)';
  if (state.runtime.camp) state.runtime.camp.dogPatrolPrimed = false;
  void dog.offsetWidth;
}

function startCampDogPatrol() {
  const dog = document.getElementById('c-dog');
  const runtime = state.runtime.camp;
  if (!dog || dog.classList.contains('done') || !runtime || state.currentScene !== 'camp' || state.scenes.camp.complete) return;
  _resetCampDogToEntrance(false);
  dog.style.display = '';
  void dog.offsetWidth;
  dog.classList.add('camp-dog-running');
  runtime.dogPatrolPrimed = true;
}

function stopCampDogPatrol(resetToStart = false) {
  const dog = document.getElementById('c-dog');
  if (!dog) return;
  if (resetToStart) {
    _resetCampDogToEntrance(false);
    return;
  }
  const body = dog.querySelector('.visitor-body');
  const dogTransform = getComputedStyle(dog).transform;
  const bodyTransform = body ? getComputedStyle(body).transform : 'none';
  dog.classList.remove('camp-dog-running');
  dog.style.transform = dogTransform === 'none' ? 'translate(0px, 0px)' : dogTransform;
  if (body) body.style.transform = bodyTransform === 'none' ? 'scaleX(-1)' : bodyTransform;
}

// ============================================================
//  TRAIL: MUDSLIDE BLOCKER
// ============================================================
let mudslideInterval = null;
function startMudslideTimer() {
  mudslideInterval = setInterval(() => {
    if (gamePaused) return;
    const sc = state.scenes.trail;
    if (sc.complete || state.currentScene !== 'trail') {
      clearInterval(mudslideInterval); return;
    }
    const el = document.getElementById('t-mudslide');
    if (!el) return;
    el.style.display = 'block';
    setFeedback('trail-feedback', '🌊 Mudslide blocking the trail! Wait it out…', 'bad');
    setTimeout(() => {
      if (el) el.style.display = 'none';
    }, 2500);
  }, 18000);
}
function stopMudslideTimer() {
  clearInterval(mudslideInterval);
  mudslideInterval = null;
  const el = document.getElementById('t-mudslide');
  if (el) el.style.display = 'none';
}

// ─── STOP ALL ACTIVE TIMERS ──────────────────────────────────
function stopAllTimers() {
  stopSceneTimer();
  stopEruptionCycle();
  stopBisonChargeTimer();
  clearTimeout(bearStartTimeout);
  bearStartTimeout = null;
  stopBearTimer();
  stopRaccoonRush();
  clearTimeout(movingVisitorStartTimeout);
  movingVisitorStartTimeout = null;
  stopMovingVisitor();
  stopGeyserVisitor3();
  stopCampFire2();
  stopCampDogPatrol(true);
  stopMudslideTimer();
  stopRangerEvents();
}

// ─── NAVIGATE TO SCENE ──────────────────────────────────────
function goToScene(scene) {
  if (state.scenes[scene].complete) {
    setFeedback(scene+'-feedback', '✅ Zone already completed! Choose another.', 'good');
    return;
  }
  if (state.runtime[scene].started) {
    state.currentScene = scene;
    state.pausedScene = scene;
    resumeCurrentScene();
    return;
  }
  stopAllTimers();
  _briefingReturnScene = null;
  showBriefing(scene);
}

function actuallyGoToScene(scene) {
  stopAllTimers();
  _resetCampDogOnBriefingReturn = false;
  ensureSceneQuestion(scene);
  renderSceneQuestion(scene);
  state.runtime[scene].started = true;
  state.runtime[scene].sceneTimeLeft = state.runtime[scene].sceneTimeLeft ?? SCENE_TIME_LIMITS[scene];
  state.currentScene = scene;
  state.pausedScene = null;
  const screenMap = { geyser:'geyser-screen', bison:'bison-screen', camp:'camp-screen', trail:'trail-screen', lake:'lake-screen' };
  showScreen(screenMap[scene]);
  if (scene === 'camp') {
    const runtime = state.runtime.camp;
    if (runtime && !runtime.dogPatrolPrimed) _resetCampDogToEntrance(true);
  }
  const overlay = document.getElementById(getPauseOverlayId(scene));
  const screen = document.getElementById(screenMap[scene]);
  if (overlay) overlay.classList.remove('visible');
  if (screen) screen.classList.remove('paused');
  initDragAndDrop(scene);

  // Start scene-specific timers and obstacles
  resumeSceneSystems(scene);

  if (scene === 'geyser') {
    state.runtime.geyser.visitor3Pending = state.scenes.geyser.visitorTotal < 3;
  }
  if (scene === 'camp') {
    state.runtime.camp.campFire2Pending = !state.scenes.camp.fire2Done && document.getElementById('c-fire2-obj')?.style.display === 'none';
  }

  const hints = {
    geyser: '⚠️ Eruptions incoming — work fast between blasts!',
    bison:  '🐂 Charge timer started — redirect visitors NOW!',
    camp:   '🐻 Bear approaching — store food before it arrives!',
    trail:  '⚠️ One hiker is on the move — click her fast!',
    lake:   '🦅 Stop visitors from feeding wildlife — every second counts!'
  };
  setFeedback(scene+'-feedback', hints[scene], '');
  updatePauseButtons();
  updateHomeButtons();
}

// ─── FEEDBACK DISPLAY ───────────────────────────────────────
function setFeedback(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'feedback-box' + (type ? ' '+type : '');
  // Auto-clear after 2.5s
  clearTimeout(el._fbTimer);
  if (type) {
    el._fbTimer = setTimeout(() => {
      el.textContent = '';
      el.className = 'feedback-box';
    }, 2500);
  }
}

// ─── POINTS POPUP ───────────────────────────────────────────
function showPointsPopup(x, y, pts, parentId) {
  const parent = document.getElementById(parentId) || document.getElementById('game-container');
  const popup = document.createElement('div');
  popup.className = 'pts-popup ' + (pts >= 0 ? 'good' : 'bad');
  popup.textContent = pts >= 0 ? `+${pts}` : `${pts}`;
  popup.style.left = x + 'px';
  popup.style.top  = y + 'px';
  parent.appendChild(popup);
  setTimeout(() => popup.remove(), 950);
}

// ─── ADD SCORE ───────────────────────────────────────────────
function addScore(pts) {
  state.score = Math.max(0, state.score + pts);
  if (pts > 0) {
    state.parkHealth = Math.min(100, state.parkHealth + Math.floor(pts / 4));
  } else {
    state.parkHealth = Math.max(0, state.parkHealth + pts);
  }
  updateHUD();
}

// ─── MARK TASK DONE ─────────────────────────────────────────
function markTaskDone(taskId) {
  const el = document.getElementById(taskId);
  if (el && !el.classList.contains('done')) el.classList.add('done');
}

// ============================================================
//  SCENE 1: GEYSER BASIN
// ============================================================

function handleGeyserVisitor(id) {
  const sc = state.scenes.geyser;
  const el = document.getElementById(id);
  if (!el || el.classList.contains('done')) return;

  sc.visitorCount++;
  const n = sc.visitorCount;
  const t = sc.visitorTotal;

  el.classList.add('correct-flash');
  setTimeout(() => el.classList.add('done'), 400);
  addScore(PTS.clickVisitor);
  const rect = el.getBoundingClientRect();
  const areaRect = document.getElementById('geyser-area').getBoundingClientRect();
  showPointsPopup(rect.left - areaRect.left, rect.top - areaRect.top - 20, PTS.clickVisitor, 'geyser-area');
  const _gLines = ['"Just one photo!" 😅', '"I had no idea!" 😬', '"The barrier was so far back?" 😮'];
  showDialogueBubble(rect.left - areaRect.left - 20, rect.top - areaRect.top - 52, _gLines[(n - 1) % _gLines.length], 'geyser-area', false, 2400);

  setFeedback('geyser-feedback', `✅ Visitor sent back to boardwalk! (${n}/${t}) (+15)`, 'good');

  // Update task text
  const taskEl = document.getElementById('task-g-visitor');
  if (taskEl) {
    const dot = taskEl.querySelector('.task-dot');
    taskEl.innerHTML = '';
    if (dot) taskEl.appendChild(dot);
    taskEl.appendChild(document.createTextNode(`Redirect visitors off boardwalk (${n}/${t})`));
  }
  if (n >= t) markTaskDone('task-g-visitor');
  checkGeyserComplete();
}

function handleTrash(id, scene) {
  const el = document.getElementById(id);
  if (!el || el.classList.contains('done')) return;

  const areaId = scene + '-area';
  const rect = el.getBoundingClientRect();
  const areaRect = document.getElementById(areaId).getBoundingClientRect();

  el.classList.add('correct-flash');
  setTimeout(() => el.classList.add('done'), 400);
  addScore(PTS.clickTrash);
  showPointsPopup(rect.left - areaRect.left, rect.top - areaRect.top - 20, PTS.clickTrash, areaId);

  // Trail litter IDs vs obstacle IDs
  const trailLitterIds = ['t-litter1','t-litter2'];
  const trailObstacleIds = ['t-branch','t-rock','t-stump'];

  if (scene === 'geyser') {
    state.scenes.geyser.trashCount++;
    const n = state.scenes.geyser.trashCount;
    const t = state.scenes.geyser.trashTotal;
    setFeedback('geyser-feedback', `🗑️ Litter removed! (${n}/${t})`, 'good');
    updateTaskCounter('task-g-trash', `Clean up all litter (${n}/${t})`);
    if (n >= t) markTaskDone('task-g-trash');
    checkGeyserComplete();

  } else if (scene === 'bison') {
    state.scenes.bison.foodRemoved++;
    const n = state.scenes.bison.foodRemoved;
    const t = state.scenes.bison.foodTotal;
    setFeedback('bison-feedback', `🥜 Attractant removed! (${n}/${t})`, 'good');
    updateTaskCounter('task-b-food', `Remove food attractants (${n}/${t})`);
    checkSpawnBisonWave2();
    if (n >= t) markTaskDone('task-b-food');
    checkBisonComplete();

  } else if (scene === 'camp') {
    state.scenes.camp.trashRemoved++;
    const n = state.scenes.camp.trashRemoved;
    const t = state.scenes.camp.trashTotal;
    setFeedback('camp-feedback', `🗑️ Trash removed! (${n}/${t})`, 'good');
    updateTaskCounter('task-c-trash', `Remove camp trash (${n}/${t})`);
    if (n >= t) markTaskDone('task-c-trash');
    checkCampComplete();

  } else if (scene === 'trail') {
    if (trailLitterIds.includes(id)) {
      // Litter pickup
      state.scenes.trail.litterRemoved++;
      const n = state.scenes.trail.litterRemoved;
      const t = state.scenes.trail.litterTotal;
      setFeedback('trail-feedback', `🗑️ Litter picked up! (${n}/${t})`, 'good');
      updateTaskCounter('task-t-litter', `Pick up trail litter (${n}/${t})`);
      if (n >= t) markTaskDone('task-t-litter');
    } else {
      // Obstacle cleared
      state.scenes.trail.obstaclesCleared++;
      const n = state.scenes.trail.obstaclesCleared;
      const t = state.scenes.trail.obstaclesTotal;
      setFeedback('trail-feedback', `🌲 Obstacle cleared! (${n}/${t})`, 'good');
      updateTaskCounter('task-t-obstacles', `Clear trail obstacles (${n}/${t})`);
      if (n >= t) markTaskDone('task-t-obstacles');
    }
    checkTrailComplete();
  }
}

// Helper: update a task's counter text (preserves the dot span)
function updateTaskCounter(taskId, text) {
  const taskEl = document.getElementById(taskId);
  if (!taskEl) return;
  const dot = taskEl.querySelector('.task-dot');
  taskEl.innerHTML = '';
  if (dot) taskEl.appendChild(dot);
  taskEl.appendChild(document.createTextNode(text));
}

function handleSceneChoice(scene, selectedIndex) {
  if (state.scenes[scene].briefingDone) return;
  const q = state.questionSet[scene];
  const taskMap = {
    geyser: 'task-g-brief',
    bison: 'task-b-brief',
    camp: 'task-c-brief',
    trail: 'task-t-brief',
    lake: 'task-l-brief'
  };
  const panelId = `choice-${scene}`;
  if (!q) return;

  if (selectedIndex !== q.correctIndex) {
    addScore(PTS.wrongClick);
    setFeedback(scene + '-feedback', q.failMsg + ' (-5)', 'bad');
    return;
  }

  state.scenes[scene].briefingDone = true;
  markTaskDone(taskMap[scene]);
  addScore(10);
  setFeedback(scene + '-feedback', q.successMsg + ' (+10)', 'good');

  const panel = document.getElementById(panelId);
  if (panel) {
    panel.querySelectorAll('.choice-option').forEach(btn => {
      btn.disabled = true;
      btn.classList.add('done');
    });
  }

  if (scene === 'geyser') checkGeyserComplete();
  if (scene === 'bison') checkBisonComplete();
  if (scene === 'camp') checkCampComplete();
  if (scene === 'trail') checkTrailComplete();
  if (scene === 'lake') checkLakeComplete();
}

function handleWrongClick(scene, elId, type) {
  addScore(PTS.wrongClick);
  // Context-aware wrong-click messages
  const typeMsg = {
    decoy:    '❌ That visitor is safe! Don\'t hassle boardwalk guests. (-5)',
    steam:    '❌ Don\'t touch the steam! That\'s a thermal hazard — stay back! (-5)',
    vent:     '❌ That\'s a thermal vent marker — leave official signs alone! (-5)',
    rock:     '❌ That\'s a natural rock! Don\'t disturb the environment. (-5)',
    flower:   '❌ That\'s a protected wildflower! Please don\'t disturb it. (-5)',
    gear:     '❌ That\'s camping equipment — not trash! Look more carefully. (-5)',
    raccoon:  '❌ Shooing a raccoon costs time! Focus on the food storage. (-5)',
    squirrel: '❌ Don\'t disturb the squirrel! Leave wildlife alone. (-5)',
    deer:     '❌ Leave the deer alone! Wildlife is not the problem here. (-5)'
  };
  setFeedback(scene+'-feedback', typeMsg[type] || '❌ Wrong target! (-5)', 'bad');

  // Flash red on the element
  if (elId) {
    const el = document.getElementById(elId);
    if (el) {
      el.classList.add('wrong-flash');
      setTimeout(() => el.classList.remove('wrong-flash'), 500);
    }
  }
}

// ─── NEW TASK HANDLERS ──────────────────────────────────────

function handleRopeRepair(id) {
  const el = document.getElementById(id);
  if (!el || el.classList.contains('done')) return;
  const sc = state.scenes.geyser;
  sc.ropeFixed++;
  const n = sc.ropeFixed, t = sc.ropeTotal;
  el.classList.add('correct-flash');
  setTimeout(() => el.classList.add('done'), 400);
  addScore(PTS.repairBarrier);
  const rect = el.getBoundingClientRect();
  const areaRect = document.getElementById('geyser-area').getBoundingClientRect();
  showPointsPopup(rect.left - areaRect.left, rect.top - areaRect.top - 20, PTS.repairBarrier, 'geyser-area');
  setFeedback('geyser-feedback', `🚧 Barrier rope restored! Thermal areas must stay roped off. (${n}/${t}) (+10)`, 'good');
  updateTaskCounter('task-g-rope', `Repair fallen barrier ropes (${n}/${t})`);
  if (n >= t) markTaskDone('task-g-rope');
  checkGeyserComplete();
}

function handleBisonCar(id) {
  const el = document.getElementById(id);
  if (!el || el.classList.contains('done')) return;
  const sc = state.scenes.bison;
  sc.roadCleared++;
  const n = sc.roadCleared, t = sc.roadTotal;
  el.classList.add('correct-flash');
  setTimeout(() => el.classList.add('done'), 400);
  addScore(PTS.clearRoad);
  const rect = el.getBoundingClientRect();
  const areaRect = document.getElementById('bison-area').getBoundingClientRect();
  showPointsPopup(rect.left - areaRect.left, rect.top - areaRect.top - 20, PTS.clearRoad, 'bison-area');
  showDialogueBubble(rect.left - areaRect.left - 20, rect.top - areaRect.top - 52, '"Sorry, ranger! Moving now!" 🚗', 'bison-area', false, 2400);
  setFeedback('bison-feedback', `🚗 Road cleared for bison! Wildlife always has right of way. (${n}/${t}) (+10)`, 'good');
  updateTaskCounter('task-b-road', `Clear road for bison crossing (${n}/${t})`);
  if (n >= t) markTaskDone('task-b-road');
  checkBisonComplete();
}

function handlePetViolation() {
  const el = document.getElementById('c-dog');
  if (!el || el.classList.contains('done')) return;
  const sc = state.scenes.camp;
  if (sc.petCited) return;
  sc.petCited = true;
  stopCampDogPatrol();
  el.classList.add('correct-flash');
  setTimeout(() => el.classList.add('done'), 400);
  addScore(PTS.citePet);
  const rect = el.getBoundingClientRect();
  const areaRect = document.getElementById('camp-area').getBoundingClientRect();
  showPointsPopup(rect.left - areaRect.left, rect.top - areaRect.top - 20, PTS.citePet, 'camp-area');
  showDialogueBubble(rect.left - areaRect.left - 20, rect.top - areaRect.top - 52, '"He doesn\'t bite!" 😅', 'camp-area', false, 2400);
  setFeedback('camp-feedback', '🐕 Leash violation cited! Pets must stay on leash to protect wildlife. (+15)', 'good');
  markTaskDone('task-c-pet');
  checkCampComplete();
}

function handleErosion(id) {
  const el = document.getElementById(id);
  if (!el || el.classList.contains('done')) return;
  const sc = state.scenes.trail;
  sc.erosionMarked++;
  const n = sc.erosionMarked, t = sc.erosionTotal;
  el.classList.add('correct-flash');
  setTimeout(() => el.classList.add('done'), 400);
  addScore(PTS.markErosion);
  const rect = el.getBoundingClientRect();
  const areaRect = document.getElementById('trail-area').getBoundingClientRect();
  showPointsPopup(rect.left - areaRect.left, rect.top - areaRect.top - 20, PTS.markErosion, 'trail-area');
  setFeedback('trail-feedback', `📋 Erosion documented for trail crew! Rangers track damage to protect native plants. (${n}/${t}) (+10)`, 'good');
  updateTaskCounter('task-t-erosion', `Document trail erosion (${n}/${t})`);
  if (n >= t) markTaskDone('task-t-erosion');
  checkTrailComplete();
}

function handleInvasiveWeed(id) {
  const el = document.getElementById(id);
  if (!el || el.classList.contains('done')) return;
  const sc = state.scenes.lake;
  sc.weedsRemoved++;
  const n = sc.weedsRemoved, t = sc.weedTotal;
  el.classList.add('correct-flash');
  setTimeout(() => el.classList.add('done'), 400);
  addScore(PTS.removeWeed);
  const rect = el.getBoundingClientRect();
  const areaRect = document.getElementById('lake-area').getBoundingClientRect();
  showPointsPopup(rect.left - areaRect.left, rect.top - areaRect.top - 20, PTS.removeWeed, 'lake-area');
  setFeedback('lake-feedback', `🌿 Invasive milfoil removed! Protecting native Yellowstone Lake ecosystem. (${n}/${t}) (+10)`, 'good');
  updateTaskCounter('task-l-weeds', `Remove invasive plants (${n}/${t})`);
  if (n >= t) markTaskDone('task-l-weeds');
  checkLakeComplete();
}

// ─── END NEW TASK HANDLERS ──────────────────────────────────

function checkGeyserComplete() {
  const sc = state.scenes.geyser;
  if (sc.visitorCount >= sc.visitorTotal && sc.signDone && sc.trashCount >= sc.trashTotal && sc.ropeFixed >= sc.ropeTotal && sc.briefingDone && !sc.complete) {
    sc.complete = true;
    triggerSceneComplete('geyser');
  }
}

// ============================================================
//  SCENE 2: BISON MEADOW
// ============================================================

function handleBisonVisitor(id) {
  const el = document.getElementById(id);
  if (!el || el.classList.contains('done')) return;
  const sc = state.scenes.bison;
  sc.visitorsFixed++;
  const n = sc.visitorsFixed;
  const t = sc.visitorsTotal;

  el.classList.add('correct-flash');
  setTimeout(() => el.classList.add('done'), 400);
  addScore(PTS.clickVisitor);

  const rect = el.getBoundingClientRect();
  const areaRect = document.getElementById('bison-area').getBoundingClientRect();
  showPointsPopup(rect.left - areaRect.left, rect.top - areaRect.top - 20, PTS.clickVisitor, 'bison-area');
  const _bLines = ['"It looked so friendly!" 😱', '"25 yards?! I thought it was feet!" 😬', '"My kids wanted a photo..." 😰'];
  showDialogueBubble(rect.left - areaRect.left - 20, rect.top - areaRect.top - 52, _bLines[(n - 1) % _bLines.length], 'bison-area', false, 2400);

  setFeedback('bison-feedback', `✅ Visitor safely moved! (${n}/${t}) (+15)`, 'good');
  updateTaskCounter('task-b-visitors', `Redirect visitors near bison (${n}/${t})`);
  if (n >= t) markTaskDone('task-b-visitors');
  // Each saved visitor resets the charge countdown — reward fast play
  resetBisonChargeTimer();
  checkBisonComplete();
}

function checkBisonComplete() {
  const sc = state.scenes.bison;
  if (sc.visitorsFixed >= sc.visitorsTotal && sc.foodRemoved >= sc.foodTotal && sc.roadCleared >= sc.roadTotal && sc.signDone && sc.briefingDone && !sc.complete) {
    sc.complete = true;
    triggerSceneComplete('bison');
  }
}

// ============================================================
//  SCENE 3: CAMPGROUND
// ============================================================

function handleCampfire() {
  const sc = state.scenes.camp;
  if (sc.fireDone) return;
  sc.fireDone = true;

  const flame = document.getElementById('c-fire-flame');
  const fireObj = document.getElementById('c-fire-obj');

  if (flame) { flame.textContent = '💧'; flame.classList.add('out'); }
  if (fireObj) fireObj.style.pointerEvents = 'none';

  addScore(PTS.extinguishFire);
  const rect = fireObj ? fireObj.getBoundingClientRect() : { left:520, top:200 };
  const areaRect = document.getElementById('camp-area').getBoundingClientRect();
  showPointsPopup(rect.left - areaRect.left, rect.top - areaRect.top - 20, PTS.extinguishFire, 'camp-area');

  const sc2 = state.scenes.camp;
  const fire1Done = sc2.fireDone;
  const fire2Done = sc2.fire2Done;
  const firesDoneCount = (fire1Done ? 1 : 0) + (fire2Done ? 1 : 0);
  if (firesDoneCount < 2) {
    updateTaskCounter('task-c-fire', `Extinguish all campfires (${firesDoneCount}/2)`);
  } else {
    markTaskDone('task-c-fire');
  }
  setFeedback('camp-feedback', '🚿 Campfire extinguished! Always douse fires completely. (+20)', 'good');
  checkCampComplete();
}

function handleCampfire2() {
  const sc = state.scenes.camp;
  if (sc.complete || sc.fire2Done) return;
  sc.fire2Done = true;
  const flame2 = document.getElementById('c-fire2-flame');
  const fireObj2 = document.getElementById('c-fire2-obj');
  if (flame2) { flame2.textContent = '💧'; flame2.classList.add('out'); }
  if (fireObj2) fireObj2.style.pointerEvents = 'none';
  addScore(PTS.extinguishFire);
  const rect = fireObj2 ? fireObj2.getBoundingClientRect() : { left:590, top:200 };
  const areaRect = document.getElementById('camp-area').getBoundingClientRect();
  showPointsPopup(rect.left - areaRect.left, rect.top - areaRect.top - 20, PTS.extinguishFire, 'camp-area');
  const sc2 = state.scenes.camp;
  const fire1Done = sc2.fireDone;
  const fire2DoneNow = sc2.fire2Done;
  const firesDoneCount = (fire1Done ? 1 : 0) + (fire2DoneNow ? 1 : 0);
  if (firesDoneCount >= 2) {
    markTaskDone('task-c-fire');
    setFeedback('camp-feedback', '🚿 Both fires extinguished! Great work! (+20)', 'good');
  } else {
    updateTaskCounter('task-c-fire', `Extinguish all campfires (${firesDoneCount}/2)`);
    setFeedback('camp-feedback', '🚿 One fire out! Get the other one! (+20)', 'good');
  }
  checkCampComplete();
}

function checkCampComplete() {
  const sc = state.scenes.camp;
  if (sc.foodStored >= sc.foodTotal && sc.trashRemoved >= sc.trashTotal && sc.fireDone && sc.fire2Done && sc.petCited && sc.briefingDone && !sc.complete) {
    sc.complete = true;
    stopBearTimer();
    triggerSceneComplete('camp');
  }
}

// ─── BEAR PRESSURE TIMER ────────────────────────────────────
let bearTimerInterval = null;
let bearTimerSeconds = 0;
const BEAR_ARRIVE_SECONDS = 10; // bear fully arrives after 10 seconds

function startBearTimer() {
  bearTimerSeconds = 0;
  stopBearTimer(); // clear any previous timer

  const bearEl     = document.getElementById('bear-pressure');
  const timerBar   = document.getElementById('bear-timer-bar');
  const timerFill  = document.getElementById('bear-timer-fill');
  const timerLabel = document.getElementById('bear-timer-label');
  const raccoon    = document.getElementById('camp-raccoon');

  if (bearEl)     { bearEl.style.right = '-70px'; bearEl.style.display = 'block'; }
  if (timerBar)   { timerBar.style.display = 'block'; timerFill.style.width = '100%'; }
  if (timerLabel) { timerLabel.style.display = 'block'; }
  if (raccoon)    { raccoon.style.display = 'block'; }

  bearTimerInterval = setInterval(() => {
    if (gamePaused) return;
    const sc = state.scenes.camp;
    if (sc.complete) { stopBearTimer(); return; }

    bearTimerSeconds++;
    const progress = bearTimerSeconds / BEAR_ARRIVE_SECONDS;

    // Animate bear sliding in from the right toward the picnic table
    if (bearEl) {
      const bearStartRight = -70;
      const bearTargetRight = 340;
      const rightPos = bearStartRight + (bearTargetRight - bearStartRight) * progress;
      bearEl.style.right = rightPos + 'px';
    }
    // Shrink timer bar
    if (timerFill) timerFill.style.width = Math.max(0, (1 - progress) * 100) + '%';

    // Bear arrives — penalize if food not stored
    if (bearTimerSeconds >= BEAR_ARRIVE_SECONDS) {
      stopBearTimer();
      showDialogueBubble(510, 215, '🐻 *sniff* ...who left food out?', 'camp-area', false, 3200);
      if (!sc.bearPenaltyGiven) {
        sc.bearPenaltyGiven = true;
        const foodLeft = sc.foodTotal - sc.foodStored;
        if (foodLeft > 0) {
          const penalty = foodLeft * -8;
          addScore(penalty);
          setFeedback('camp-feedback', `🐻 The bear reached the food! ${foodLeft} item(s) unsecured. (${penalty} pts)`, 'bad');
          if (timerLabel) timerLabel.textContent = '🐻 Bear got the food!';
        } else {
          setFeedback('camp-feedback', '✅ Food all locked up before the bear arrived!', 'good');
          if (timerLabel) timerLabel.textContent = '✅ Bear left — food secured!';
        }
        // Reset bear position
        if (bearEl) { bearEl.style.right = '-70px'; setTimeout(() => { if (bearEl) bearEl.style.display = 'none'; }, 2000); }
      }
    }
  }, 1000);
}

function stopBearTimer() {
  if (bearTimerInterval) { clearInterval(bearTimerInterval); bearTimerInterval = null; }
  const bearEl     = document.getElementById('bear-pressure');
  const timerBar   = document.getElementById('bear-timer-bar');
  const timerLabel = document.getElementById('bear-timer-label');
  const raccoon    = document.getElementById('camp-raccoon');
  if (bearEl)     { bearEl.style.right = '-70px'; setTimeout(() => { if (bearEl) bearEl.style.display = 'none'; }, 500); }
  if (timerBar)   timerBar.style.display = 'none';
  if (timerLabel) timerLabel.style.display = 'none';
  if (raccoon)    raccoon.style.display = 'none';
}

// ============================================================
//  SCENE 4: FOREST TRAIL
// ============================================================

function handleTrailVisitor(id) {
  const sc = state.scenes.trail;
  const el = document.getElementById(id);
  if (!el || el.classList.contains('done')) return;

  sc.visitorsFixed++;
  const n = sc.visitorsFixed;
  const t = sc.visitorsTotal;

  el.classList.add('correct-flash');
  setTimeout(() => el.classList.add('done'), 400);
  addScore(PTS.clickVisitor);

  const rect = el.getBoundingClientRect();
  const areaRect = document.getElementById('trail-area').getBoundingClientRect();
  showPointsPopup(rect.left - areaRect.left, rect.top - areaRect.top - 20, PTS.clickVisitor, 'trail-area');
  const _tLines = ['"GPS led me wrong... sorry!" 📍', '"I was following a deer!" 🦌', '"I just wanted the waterfall!" 😓'];
  showDialogueBubble(rect.left - areaRect.left - 20, rect.top - areaRect.top - 52, _tLines[(n - 1) % _tLines.length], 'trail-area', false, 2400);

  setFeedback('trail-feedback', `✅ Hiker guided back to trail! (${n}/${t}) (+15)`, 'good');
  updateTaskCounter('task-t-visitor', `Redirect hikers back to trail (${n}/${t})`);
  if (n >= t) markTaskDone('task-t-visitor');
  checkTrailComplete();
}

function checkTrailComplete() {
  const sc = state.scenes.trail;
  if (
    sc.visitorsFixed >= sc.visitorsTotal &&
    sc.obstaclesCleared >= sc.obstaclesTotal &&
    sc.litterRemoved >= sc.litterTotal &&
    sc.erosionMarked >= sc.erosionTotal &&
    sc.signDone &&
    sc.briefingDone && !sc.complete
  ) {
    sc.complete = true;
    triggerSceneComplete('trail');
  }
}

// ============================================================
//  SCENE 5: YELLOWSTONE LAKE
// ============================================================

function handleLakeVisitor(id) {
  const el = document.getElementById(id);
  if (!el || el.classList.contains('done')) return;
  const sc = state.scenes.lake;
  sc.visitorsFixed++;
  const n = sc.visitorsFixed;
  const t = sc.visitorsTotal;

  el.classList.add('correct-flash');
  setTimeout(() => el.classList.add('done'), 400);
  addScore(PTS.clickVisitor);

  const rect = el.getBoundingClientRect();
  const areaRect = document.getElementById('lake-area').getBoundingClientRect();
  showPointsPopup(rect.left - areaRect.left, rect.top - areaRect.top - 20, PTS.clickVisitor, 'lake-area');

  const _lLines = ['"But the duck was hungry!" 😅', '"I didn\'t know it was illegal!" 😬', '"They looked so friendly..." 😮'];
  showDialogueBubble(rect.left - areaRect.left - 20, rect.top - areaRect.top - 52, _lLines[(n - 1) % _lLines.length], 'lake-area', false, 2400);

  setFeedback('lake-feedback', `🚫 Visitor stopped! Feeding wildlife is prohibited. (${n}/${t}) (+15)`, 'good');
  updateTaskCounter('task-l-visitors', `Stop visitors feeding wildlife (${n}/${t})`);
  if (n >= t) markTaskDone('task-l-visitors');
  checkLakeComplete();
}

function handleLakeFood(id, scene) {
  const el = document.getElementById(id);
  if (!el || el.classList.contains('done')) return;
  const sc = state.scenes.lake;
  sc.foodRemoved++;
  const n = sc.foodRemoved;
  const t = sc.foodTotal;

  el.classList.add('correct-flash');
  setTimeout(() => el.classList.add('done'), 400);
  addScore(PTS.clickTrash);

  const rect = el.getBoundingClientRect();
  const areaRect = document.getElementById('lake-area').getBoundingClientRect();
  showPointsPopup(rect.left - areaRect.left, rect.top - areaRect.top - 20, PTS.clickTrash, 'lake-area');

  setFeedback('lake-feedback', `🍞 Food confiscated! (${n}/${t}) (+10)`, 'good');
  updateTaskCounter('task-l-food', `Remove food attractants (${n}/${t})`);
  if (n >= t) markTaskDone('task-l-food');
  checkLakeComplete();
}

function checkLakeComplete() {
  const sc = state.scenes.lake;
  if (
    sc.visitorsFixed >= sc.visitorsTotal &&
    sc.foodRemoved >= sc.foodTotal &&
    sc.weedsRemoved >= sc.weedTotal &&
    sc.signDone &&
    sc.briefingDone && !sc.complete
  ) {
    sc.complete = true;
    triggerSceneComplete('lake');
  }
}

// ============================================================
//  SCENE COMPLETE HANDLER
// ============================================================

function triggerSceneComplete(scene) {
  stopAllTimers();                          // stop all active pressure mechanics
  gamePaused = false;
  document.getElementById('pause-overlay').classList.remove('active');
  state.pausedScene = null;
  addScore(PTS.sceneBonus);
  state.completedZones.push(scene);
  state.badges.push(scene);

  const bonusPtsEl = document.getElementById(scene + '-bonus-pts');
  if (bonusPtsEl) bonusPtsEl.textContent = `+${PTS.sceneBonus} Bonus Points! Total: ${state.score}`;

  const overlay = document.getElementById(scene + '-complete');
  if (overlay) overlay.classList.add('visible');

  // Hide footer (task list + radio panel) — no longer needed after completion
  const screenEl = document.getElementById(scene + '-screen');
  const footer = screenEl ? screenEl.querySelector('.scene-footer') : null;
  if (footer) footer.style.display = 'none';

  updateHUD();
}

function completeScene(scene) {
  stopAllTimers();
  state.currentScene = null;
  state.pausedScene = null;
  updateMapUI();
  showScreen('map-screen');
  updateHomeButtons();

  if (state.completedZones.length === 5) {
    setTimeout(() => showResults(), 600);
  }
}

// ============================================================
//  RESULTS SCREEN
// ============================================================

function showResults() {
  // Determine rank
  const score = state.score;
  let rank, rankColor;
  if (score >= 90) { rank = '🏆 Park Hero'; rankColor = '#f0d060'; }
  else if (score >= 70) { rank = '🌿 Wildlife Guardian'; rankColor = '#badc58'; }
  else if (score >= 50) { rank = '🔰 Junior Ranger'; rankColor = '#74b9ff'; }
  else { rank = '😅 Needs More Patrol'; rankColor = '#fd79a8'; }

  const rankEl = document.getElementById('result-rank');
  if (rankEl) { rankEl.textContent = rank; rankEl.style.color = rankColor; }

  const scoreEl = document.getElementById('result-score-display');
  if (scoreEl) scoreEl.textContent = `Final Score: ${score} pts | Park Health: ${Math.round(state.parkHealth)}%`;

  // Render badges
  const badgesEl = document.getElementById('result-badges');
  if (badgesEl) {
    badgesEl.innerHTML = '';
    Object.entries(BADGES).forEach(([zone, badge]) => {
      const earned = state.badges.includes(zone);
      const item = document.createElement('div');
      item.className = 'result-badge-item' + (earned ? '' : ' locked');
      item.innerHTML = `<div class="result-badge-icon">${badge.icon}</div><div class="result-badge-name">${badge.name}</div>`;
      badgesEl.appendChild(item);
    });
  }

  // Random tip
  const tipEl = document.getElementById('result-tip');
  if (tipEl) tipEl.textContent = '"' + RANGER_TIPS[Math.floor(Math.random() * RANGER_TIPS.length)] + '"';

  // Story narrative based on performance
  const storyEl = document.getElementById('result-story');
  if (storyEl) {
    let story;
    if (score >= 90) {
      story = "Martinez's radio crackles:\n\"Alex... I've been doing this job 20 years. Today you handled four simultaneous incidents and kept every single person safe. That doesn't happen on Day 1.\"\n\nYellowstone was still standing. The geysers still steamed. The bison grazed undisturbed.\n\nRanger Alex Chen closed the patrol log — and was already thinking about tomorrow.";
    } else if (score >= 70) {
      story = "\"Good work today, rookie,\" Martinez said, voice softer than expected.\n\"Not perfect — but Yellowstone doesn't ask for perfect. It asks for committed.\"\n\nAlex watched the sun dip behind the Absaroka Range. A few things slipped through. But the park was okay.\n\nThat was enough. For Day 1.";
    } else if (score >= 50) {
      story = "The debrief was quiet for a long moment.\n\"You learned a lot today,\" Martinez finally said. \"The hard way. But that's how it sticks out here.\"\n\nYellowstone had seen worse. Visitors would return. Animals would adapt.\n\nAlex opened the training manual again. Tomorrow would be different.";
    } else {
      story = "Martinez sighed over the radio.\n\"The park survived. You survived. That's the floor, Alex — not the ceiling.\"\n\nSome days in the wilderness are humbling. That's why the training exists. That's why rangers come back.\n\nAlex set an alarm for 5:00 AM. There was always tomorrow.";
    }
    storyEl.textContent = story;
  }

  showScreen('result-screen');
}

// ============================================================
//  DRAG AND DROP SYSTEM
// ============================================================

// Track which draggables belong to which scene
const SCENE_DRAGGABLES = {
  geyser: [{ id:'g-sign', dropId:'g-sign-drop', task:'signDone', scene:'geyser', taskKey:'task-g-sign', feedbackId:'geyser-feedback', feedbackMsg:'✅ Warning sign placed correctly! (+20)', areaId:'geyser-area', pts: PTS.dragSign, check: checkGeyserComplete }],
  bison:  [{ id:'b-sign', dropId:'b-sign-drop', task:'signDone', scene:'bison', taskKey:'task-b-sign', feedbackId:'bison-feedback', feedbackMsg:'✅ Safety sign placed! Keep visitors back! (+20)', areaId:'bison-area', pts: PTS.dragSign, check: checkBisonComplete }],
  camp:   [
    { id:'c-food1', dropId:'camp-locker-drop', task:null, scene:'camp', taskKey:'task-c-food', feedbackId:'camp-feedback', feedbackMsg:'🔒 Food secured! (n/5)', areaId:'camp-area', pts: PTS.dragFood, check: checkCampComplete, isFood: true },
    { id:'c-food2', dropId:'camp-locker-drop', task:null, scene:'camp', taskKey:'task-c-food', feedbackId:'camp-feedback', feedbackMsg:'🔒 Food secured! (n/5)', areaId:'camp-area', pts: PTS.dragFood, check: checkCampComplete, isFood: true },
    { id:'c-food3', dropId:'camp-locker-drop', task:null, scene:'camp', taskKey:'task-c-food', feedbackId:'camp-feedback', feedbackMsg:'🔒 Food secured! (n/5)', areaId:'camp-area', pts: PTS.dragFood, check: checkCampComplete, isFood: true },
    { id:'c-food4', dropId:'camp-locker-drop', task:null, scene:'camp', taskKey:'task-c-food', feedbackId:'camp-feedback', feedbackMsg:'🔒 Food secured! (n/5)', areaId:'camp-area', pts: PTS.dragFood, check: checkCampComplete, isFood: true },
    { id:'c-food5', dropId:'camp-locker-drop', task:null, scene:'camp', taskKey:'task-c-food', feedbackId:'camp-feedback', feedbackMsg:'🔒 Food secured! (n/5)', areaId:'camp-area', pts: PTS.dragFood, check: checkCampComplete, isFood: true }
  ],
  trail:  [{ id:'t-sign', dropId:'t-sign-drop', task:'signDone', scene:'trail', taskKey:'task-t-sign', feedbackId:'trail-feedback', feedbackMsg:'✅ Trail sign back in position! (+20)', areaId:'trail-area', pts: PTS.dragSign, check: checkTrailComplete }],
  lake:   [{ id:'l-sign', dropId:'l-sign-drop', task:'signDone', scene:'lake', taskKey:'task-l-sign', feedbackId:'lake-feedback', feedbackMsg:'🚫 No Feeding sign posted at the shore! (+20)', areaId:'lake-area', pts: PTS.dragSign, check: checkLakeComplete }]
};

let activeDrag = null;      // currently dragged element config
let dragEl = null;          // DOM element
let dragOffsetX = 0;
let dragOffsetY = 0;
let dragStartX = 0;
let dragStartY = 0;

function initDragAndDrop(scene) {
  const draggables = SCENE_DRAGGABLES[scene] || [];
  draggables.forEach(cfg => {
    const el = document.getElementById(cfg.id);
    if (!el || el.classList.contains('done')) return;
    // Remove old listeners by cloning
    const newEl = el.cloneNode(true);
    el.parentNode.replaceChild(newEl, el);
    newEl.addEventListener('mousedown', e => startDrag(e, cfg, newEl));
    newEl.addEventListener('touchstart', e => startDragTouch(e, cfg, newEl), { passive: false });
  });
}

function startDrag(e, cfg, el) {
  if (el.classList.contains('done')) return;
  e.preventDefault();
  activeDrag = cfg;
  dragEl = el;

  const area = document.getElementById(cfg.areaId);
  const areaRect = area.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();

  dragOffsetX = e.clientX - elRect.left;
  dragOffsetY = e.clientY - elRect.top;
  dragStartX = elRect.left - areaRect.left;
  dragStartY = elRect.top - areaRect.top;

  el.classList.add('dragging');
  el.style.position = 'absolute';
  el.style.zIndex = 50;
  el.style.left = dragStartX + 'px';
  el.style.top = dragStartY + 'px';
  el.style.right = '';
  el.style.bottom = '';

  // Highlight drop zone
  const dz = document.getElementById(cfg.dropId);
  if (dz) dz.classList.add('highlight');

  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
}

function startDragTouch(e, cfg, el) {
  if (el.classList.contains('done')) return;
  e.preventDefault();
  const touch = e.touches[0];
  const fakeEvent = { clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => {} };
  startDrag(fakeEvent, cfg, el);

  document.addEventListener('touchmove', onDragMoveTouch, { passive: false });
  document.addEventListener('touchend', onDragEndTouch);
}

function onDragMove(e) {
  if (!dragEl || !activeDrag) return;
  const area = document.getElementById(activeDrag.areaId);
  const areaRect = area.getBoundingClientRect();
  const x = e.clientX - areaRect.left - dragOffsetX;
  const y = e.clientY - areaRect.top - dragOffsetY;
  dragEl.style.left = x + 'px';
  dragEl.style.top = y + 'px';
}

function onDragMoveTouch(e) {
  e.preventDefault();
  if (!dragEl || !activeDrag) return;
  const touch = e.touches[0];
  const area = document.getElementById(activeDrag.areaId);
  const areaRect = area.getBoundingClientRect();
  const x = touch.clientX - areaRect.left - dragOffsetX;
  const y = touch.clientY - areaRect.top - dragOffsetY;
  dragEl.style.left = x + 'px';
  dragEl.style.top = y + 'px';
}

function onDragEnd(e) {
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  finalizeDrop(e.clientX, e.clientY);
}

function onDragEndTouch(e) {
  document.removeEventListener('touchmove', onDragMoveTouch);
  document.removeEventListener('touchend', onDragEndTouch);
  const touch = e.changedTouches[0];
  finalizeDrop(touch.clientX, touch.clientY);
}

function finalizeDrop(clientX, clientY) {
  if (!dragEl || !activeDrag) return;

  const cfg = activeDrag;
  const dropZone = document.getElementById(cfg.dropId);
  dragEl.classList.remove('dragging');

  let dropped = false;
  if (dropZone) {
    const dzRect = dropZone.getBoundingClientRect();
    if (
      clientX >= dzRect.left && clientX <= dzRect.right &&
      clientY >= dzRect.top  && clientY <= dzRect.bottom
    ) {
      dropped = true;
    }
  }

  if (dropped) {
    // Snap into drop zone
    const area = document.getElementById(cfg.areaId);
    const areaRect = area.getBoundingClientRect();
    const dzRect = dropZone.getBoundingClientRect();

    // Default snap position
    let snapOffsetX = 4, snapOffsetY = 4;

    // For food items: spread across a 2×2+1 grid so each item is visible
    if (cfg.isFood) {
      const foodSlots = [
        [4,  4 ], [46, 4 ],   // row 1: two items side-by-side
        [4,  46], [46, 46],   // row 2: two items side-by-side
        [25, 66]              // row 3: one item centred
      ];
      const slot = Math.min(state.scenes.camp.foodStored, 4);
      snapOffsetX = foodSlots[slot][0];
      snapOffsetY = foodSlots[slot][1];
    }

    dragEl.style.left = (dzRect.left - areaRect.left + snapOffsetX) + 'px';
    dragEl.style.top  = (dzRect.top  - areaRect.top  + snapOffsetY) + 'px';
    dragEl.style.right = '';
    dragEl.style.bottom = '';
    dragEl.style.border = '2px solid #6ab04c';
    dragEl.style.pointerEvents = 'none';

    dropZone.classList.add('filled');
    dropZone.classList.remove('highlight');

    addScore(cfg.pts);
    showPointsPopup(dzRect.left - areaRect.left, dzRect.top - areaRect.top - 20, cfg.pts, cfg.areaId);

    // Handle food for camp
    if (cfg.isFood) {
      state.scenes.camp.foodStored++;
      const n = state.scenes.camp.foodStored;
      const t = state.scenes.camp.foodTotal;
      let msg = cfg.feedbackMsg.replace('n', n);
      setFeedback(cfg.feedbackId, msg, 'good');
      updateTaskCounter(cfg.taskKey, `Store food in bear locker (${n}/${t})`);
      if (n >= t) markTaskDone(cfg.taskKey);
    } else {
      // Sign drop
      state.scenes[cfg.scene][cfg.task] = true;
      setFeedback(cfg.feedbackId, cfg.feedbackMsg, 'good');
      markTaskDone(cfg.taskKey);
    }

    setTimeout(() => { if (cfg.check) cfg.check(); }, 200);

    // Fade the dragged item after snap
    setTimeout(() => {
      dragEl.classList.add('done');
    }, 300);

  } else {
    // Snap back to original position
    dropZone && dropZone.classList.remove('highlight');
    dragEl.style.left = dragStartX + 'px';
    dragEl.style.top = dragStartY + 'px';
    setFeedback(cfg.feedbackId, '↩️ Drag it to the highlighted drop zone!', '');
  }

  activeDrag = null;
  dragEl = null;
}

function showBearWarning() {
  const bear = document.getElementById('bear-warn');
  if (!bear) return;
  bear.style.opacity = '1';
  bear.style.right = '300px';
  setTimeout(() => {
    bear.style.opacity = '0';
    bear.style.right = '-60px';
  }, 2000);
}

// ============================================================
//  PAUSE SYSTEM
// ============================================================

function pauseGame() {
  if (!state.currentScene) return;
  gamePaused = true;
  _pausedScene = state.currentScene;
  const sceneNames = { geyser: 'Old Faithful Geyser', bison: 'Bison Meadow', camp: 'Campground', trail: 'Forest Trail' };
  const el = document.getElementById('pause-scene-name');
  if (el) el.textContent = sceneNames[_pausedScene] || _pausedScene;
  document.getElementById('pause-overlay').classList.add('active');
}

function resumeGame() {
  gamePaused = false;
  document.getElementById('pause-overlay').classList.remove('active');
  _pausedScene = null;
}

function rereadMission() {
  gamePaused = false;
  document.getElementById('pause-overlay').classList.remove('active');
  _rereadMode = true;
  showBriefing(_pausedScene);
  _pausedScene = null;
}

function pauseGoToMap() {
  gamePaused = false;
  document.getElementById('pause-overlay').classList.remove('active');
  _pausedScene = null;
  stopAllTimers();
  goToMap();
}

function pauseGoToStart() {
  gamePaused = false;
  document.getElementById('pause-overlay').classList.remove('active');
  _pausedScene = null;
  stopAllTimers();
  state.score = 0;
  state.currentScene = null;
  showScreen('start-screen');
}

// ============================================================
//  INITIALIZE ON LOAD
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  // Everything starts from start screen — already set active in HTML
  // No auto-start; wait for player to click
  console.log('🏕️ Save the Park: Yellowstone Ranger Patrol loaded!');
});
