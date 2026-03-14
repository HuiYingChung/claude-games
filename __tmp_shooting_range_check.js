
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Polyfill for roundRect
if (!ctx.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (typeof r === 'number') r = [r, r, r, r];
    const [tl, tr, br, bl] = r;
    this.moveTo(x + tl, y);
    this.lineTo(x + w - tr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + tr);
    this.lineTo(x + w, y + h - br);
    this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    this.lineTo(x + bl, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - bl);
    this.lineTo(x, y + tl);
    this.quadraticCurveTo(x, y, x + tl, y);
    this.closePath();
    return this;
  };
}

let W, H;
function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// Settings
let gameDuration = 30;
let speedSetting = 'medium';
let aimAssist = true;

// Game state
let gameRunning = false;
let score = 0;
let timeLeft = 30;
let totalShots = 0;
let totalHits = 0;
let combo = 0;
let maxCombo = 0;
let longestShot = 0;
let targets = [];
let particles = [];
let mouseX = W / 2, mouseY = H / 2;
let muzzleFlash = 0;
let gunRecoil = 0;
let lastTime = 0;
let timerInterval = null;

document.body.style.cursor = 'default';

// 3D perspective
const VP = { x: 0, y: 0, fov: 600 }; // vanishing point, field of view
const GROUND_Y = 0.65; // ground horizon ratio
const MIN_Z = 2;
const MAX_Z = 18;

// Speed multipliers
const SPEED_MAP = { slow: 0.4, medium: 0.8, fast: 1.5 };

// Audio context
let audioCtx = null;
function initAudio() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } catch(e) { /* audio not available */ }
}

function playSound(type) {
  if (!audioCtx) return;
  try { _playSound(type); } catch(e) { /* ignore audio errors */ }
}

function _playSound(type) {
  const now = audioCtx.currentTime;
  const sr = audioCtx.sampleRate;

  if (type === 'shoot') {
    // Realistic gunshot: initial crack + body + tail reverb
    // Layer 1: Sharp transient crack
    const crackLen = sr * 0.03;
    const crackBuf = audioCtx.createBuffer(1, crackLen, sr);
    const crackData = crackBuf.getChannelData(0);
    for (let i = 0; i < crackLen; i++) {
      const t = i / sr;
      crackData[i] = (Math.random() * 2 - 1) * Math.exp(-t * 200) * 0.9;
    }
    const crackSrc = audioCtx.createBufferSource();
    crackSrc.buffer = crackBuf;
    const crackGain = audioCtx.createGain();
    crackGain.gain.setValueAtTime(0.7, now);
    const crackHP = audioCtx.createBiquadFilter();
    crackHP.type = 'highpass';
    crackHP.frequency.value = 2000;
    crackSrc.connect(crackHP).connect(crackGain).connect(audioCtx.destination);
    crackSrc.start(now);

    // Layer 2: Low boom body
    const boomLen = sr * 0.25;
    const boomBuf = audioCtx.createBuffer(1, boomLen, sr);
    const boomData = boomBuf.getChannelData(0);
    for (let i = 0; i < boomLen; i++) {
      const t = i / sr;
      boomData[i] = (Math.random() * 2 - 1) * Math.exp(-t * 18) * 0.5;
      boomData[i] += Math.sin(t * 80 * Math.PI * 2) * Math.exp(-t * 25) * 0.3;
      boomData[i] += Math.sin(t * 55 * Math.PI * 2) * Math.exp(-t * 20) * 0.2;
    }
    const boomSrc = audioCtx.createBufferSource();
    boomSrc.buffer = boomBuf;
    const boomGain = audioCtx.createGain();
    boomGain.gain.setValueAtTime(0.5, now);
    const boomLP = audioCtx.createBiquadFilter();
    boomLP.type = 'lowpass';
    boomLP.frequency.setValueAtTime(1500, now);
    boomLP.frequency.exponentialRampToValueAtTime(200, now + 0.2);
    boomSrc.connect(boomLP).connect(boomGain).connect(audioCtx.destination);
    boomSrc.start(now);

    // Layer 3: Reverb tail (outdoor range echo)
    const tailLen = sr * 0.5;
    const tailBuf = audioCtx.createBuffer(1, tailLen, sr);
    const tailData = tailBuf.getChannelData(0);
    for (let i = 0; i < tailLen; i++) {
      const t = i / sr;
      tailData[i] = (Math.random() * 2 - 1) * Math.exp(-t * 6) * 0.12;
    }
    const tailSrc = audioCtx.createBufferSource();
    tailSrc.buffer = tailBuf;
    const tailGain = audioCtx.createGain();
    tailGain.gain.setValueAtTime(0, now);
    tailGain.gain.linearRampToValueAtTime(0.15, now + 0.05);
    tailGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    const tailLP = audioCtx.createBiquadFilter();
    tailLP.type = 'lowpass';
    tailLP.frequency.value = 800;
    tailSrc.connect(tailLP).connect(tailGain).connect(audioCtx.destination);
    tailSrc.start(now + 0.01);

    // Layer 4: Mechanical click (slide action)
    const clickOsc = audioCtx.createOscillator();
    const clickGain = audioCtx.createGain();
    clickOsc.type = 'square';
    clickOsc.frequency.setValueAtTime(3500, now + 0.06);
    clickOsc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
    clickGain.gain.setValueAtTime(0, now);
    clickGain.gain.setValueAtTime(0.06, now + 0.06);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    clickOsc.connect(clickGain).connect(audioCtx.destination);
    clickOsc.start(now + 0.06);
    clickOsc.stop(now + 0.1);
  }
  else if (type === 'hit') {
    // Metal target clang: impact + resonance + wobble
    // Impact thud
    const impactOsc = audioCtx.createOscillator();
    const impactGain = audioCtx.createGain();
    impactOsc.type = 'sine';
    impactOsc.frequency.setValueAtTime(220, now);
    impactOsc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
    impactGain.gain.setValueAtTime(0.3, now);
    impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    impactOsc.connect(impactGain).connect(audioCtx.destination);
    impactOsc.start(now);
    impactOsc.stop(now + 0.1);

    // Metal ring (multiple harmonics)
    [680, 1360, 2100, 3200].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * (0.95 + Math.random() * 0.1), now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + 0.4);
      const vol = 0.15 / (i + 1);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3 - i * 0.05);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    });

    // Steel plate wobble
    const wobbleOsc = audioCtx.createOscillator();
    const wobbleGain = audioCtx.createGain();
    wobbleOsc.type = 'sine';
    wobbleOsc.frequency.setValueAtTime(420, now + 0.02);
    // Vibrato for wobble effect
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    lfo.frequency.value = 12;
    lfoGain.gain.value = 30;
    lfo.connect(lfoGain).connect(wobbleOsc.frequency);
    lfo.start(now);
    lfo.stop(now + 0.4);
    wobbleGain.gain.setValueAtTime(0.08, now + 0.02);
    wobbleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    wobbleOsc.connect(wobbleGain).connect(audioCtx.destination);
    wobbleOsc.start(now + 0.02);
    wobbleOsc.stop(now + 0.4);
  }
  else if (type === 'miss') {
    // Bullet whiz-by + dirt impact
    // Whiz
    const whizOsc = audioCtx.createOscillator();
    const whizGain = audioCtx.createGain();
    whizOsc.type = 'sawtooth';
    whizOsc.frequency.setValueAtTime(3000, now);
    whizOsc.frequency.exponentialRampToValueAtTime(400, now + 0.15);
    whizGain.gain.setValueAtTime(0.04, now);
    whizGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    const whizBP = audioCtx.createBiquadFilter();
    whizBP.type = 'bandpass';
    whizBP.frequency.value = 1500;
    whizBP.Q.value = 3;
    whizOsc.connect(whizBP).connect(whizGain).connect(audioCtx.destination);
    whizOsc.start(now);
    whizOsc.stop(now + 0.15);

    // Dirt thud
    const dirtLen = sr * 0.08;
    const dirtBuf = audioCtx.createBuffer(1, dirtLen, sr);
    const dirtData = dirtBuf.getChannelData(0);
    for (let i = 0; i < dirtLen; i++) {
      const t = i / sr;
      dirtData[i] = (Math.random() * 2 - 1) * Math.exp(-t * 60) * 0.2;
    }
    const dirtSrc = audioCtx.createBufferSource();
    dirtSrc.buffer = dirtBuf;
    const dirtGain = audioCtx.createGain();
    dirtGain.gain.setValueAtTime(0.2, now + 0.02);
    const dirtLP = audioCtx.createBiquadFilter();
    dirtLP.type = 'lowpass';
    dirtLP.frequency.value = 400;
    dirtSrc.connect(dirtLP).connect(dirtGain).connect(audioCtx.destination);
    dirtSrc.start(now + 0.02);
  }
  else if (type === 'combo') {
    // Satisfying ascending chime with shimmer
    [0, 0.05, 0.1, 0.15].forEach((delay, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 523 * Math.pow(1.26, i); // C5 major arpeggio
      gain.gain.setValueAtTime(0.15, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.25);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.25);
      // Shimmer harmonic
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = 523 * Math.pow(1.26, i) * 2;
      gain2.gain.setValueAtTime(0.05, now + delay);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);
      osc2.connect(gain2).connect(audioCtx.destination);
      osc2.start(now + delay);
      osc2.stop(now + delay + 0.15);
    });
  }
  else if (type === 'gameOver') {
    // Dramatic end: deep brass-like chord + fading reverb
    // Low tone
    const bass = audioCtx.createOscillator();
    const bassGain = audioCtx.createGain();
    bass.type = 'sawtooth';
    bass.frequency.value = 110;
    bassGain.gain.setValueAtTime(0.15, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    const bassLP = audioCtx.createBiquadFilter();
    bassLP.type = 'lowpass';
    bassLP.frequency.setValueAtTime(800, now);
    bassLP.frequency.exponentialRampToValueAtTime(100, now + 1.5);
    bass.connect(bassLP).connect(bassGain).connect(audioCtx.destination);
    bass.start(now);
    bass.stop(now + 1.5);

    // Descending minor chord
    [0, 0.1, 0.2, 0.4, 0.7].forEach((delay, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      const notes = [440, 392, 349, 330, 262]; // A4 G4 F4 E4 C4
      osc.frequency.value = notes[i];
      gain.gain.setValueAtTime(0.12, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.6);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.6);
    });

    // Cymbal-like wash
    const washLen = sr * 1.2;
    const washBuf = audioCtx.createBuffer(1, washLen, sr);
    const washData = washBuf.getChannelData(0);
    for (let i = 0; i < washLen; i++) {
      const t = i / sr;
      washData[i] = (Math.random() * 2 - 1) * Math.exp(-t * 3) * 0.06;
    }
    const washSrc = audioCtx.createBufferSource();
    washSrc.buffer = washBuf;
    const washGain = audioCtx.createGain();
    washGain.gain.setValueAtTime(0.1, now);
    const washHP = audioCtx.createBiquadFilter();
    washHP.type = 'highpass';
    washHP.frequency.value = 3000;
    washSrc.connect(washHP).connect(washGain).connect(audioCtx.destination);
    washSrc.start(now);
  }
  else if (type === 'countdown') {
    // Tactical beep
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    const isUrgent = timeLeft <= 3;
    osc.frequency.value = isUrgent ? 1200 : 600;
    gain.gain.setValueAtTime(isUrgent ? 0.25 : 0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isUrgent ? 0.12 : 0.08));
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.12);

    if (isUrgent) {
      // Double beep for urgency
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = 1200;
      gain2.gain.setValueAtTime(0.2, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc2.connect(gain2).connect(audioCtx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.16);
    }
  }
}

// 3D projection
function project(x3d, y3d, z3d) {
  const scale = VP.fov / (VP.fov + z3d * 80);
  const sx = W / 2 + x3d * scale * 80;
  const sy = H * GROUND_Y - y3d * scale * 80;
  return { x: sx, y: sy, scale: scale };
}

// Target class
class Target {
  constructor() {
    this.reset(true);
  }

  reset(initial = false) {
    this.z = MIN_Z + Math.random() * (MAX_Z - MIN_Z);
    this.x = (Math.random() - 0.5) * this.z * 1.5;
    this.y = 0.5 + Math.random() * (2 + this.z * 0.15);
    this.baseRadius = 0.4 + Math.random() * 0.3;

    // Movement
    const spd = SPEED_MAP[speedSetting];
    this.vx = (Math.random() - 0.5) * spd * 1.5;
    this.vy = (Math.random() - 0.5) * spd * 0.8;
    this.vz = (Math.random() - 0.5) * spd * 0.4;

    // Direction change timer
    this.dirTimer = 1 + Math.random() * 2;

    this.alive = true;
    this.hitAnim = 0;

    // Score based on depth
    this.points = Math.round(10 + (this.z - MIN_Z) / (MAX_Z - MIN_Z) * 90);

    if (initial) {
      this.spawnAnim = 1;
    } else {
      this.spawnAnim = 0;
    }
  }

  update(dt) {
    if (!this.alive) {
      this.hitAnim -= dt * 3;
      if (this.hitAnim <= 0) this.reset();
      return;
    }

    if (this.spawnAnim < 1) {
      this.spawnAnim = Math.min(1, this.spawnAnim + dt * 3);
    }

    const spd = SPEED_MAP[speedSetting];

    // Direction change
    this.dirTimer -= dt;
    if (this.dirTimer <= 0) {
      this.vx = (Math.random() - 0.5) * spd * 1.5;
      this.vy = (Math.random() - 0.5) * spd * 0.8;
      this.vz = (Math.random() - 0.5) * spd * 0.4;
      this.dirTimer = 1 + Math.random() * 2;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;

    // Boundaries
    const maxX = this.z * 1.2;
    if (this.x < -maxX) { this.x = -maxX; this.vx = Math.abs(this.vx); }
    if (this.x > maxX) { this.x = maxX; this.vx = -Math.abs(this.vx); }
    if (this.y < 0.3) { this.y = 0.3; this.vy = Math.abs(this.vy); }
    if (this.y > 3 + this.z * 0.15) { this.y = 3 + this.z * 0.15; this.vy = -Math.abs(this.vy); }
    if (this.z < MIN_Z) { this.z = MIN_Z; this.vz = Math.abs(this.vz); }
    if (this.z > MAX_Z) { this.z = MAX_Z; this.vz = -Math.abs(this.vz); }

    this.points = Math.round(10 + (this.z - MIN_Z) / (MAX_Z - MIN_Z) * 90);
  }

  getScreenPos() {
    const p = project(this.x, this.y, this.z);
    const screenRadius = this.baseRadius * p.scale * 50 * this.spawnAnim;
    return { ...p, radius: screenRadius };
  }

  draw() {
    const pos = this.getScreenPos();

    if (!this.alive) {
      // Enhanced hit animation - shrapnel + sparks + shockwave
      const progress = 1 - this.hitAnim;
      // Shockwave ring
      ctx.globalAlpha = this.hitAnim * 0.4;
      ctx.strokeStyle = '#e94560';
      ctx.lineWidth = Math.max(1, pos.radius * 0.08 * this.hitAnim);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, pos.radius * (1 + progress * 3), 0, Math.PI * 2);
      ctx.stroke();
      // Fragments with rotation
      ctx.globalAlpha = this.hitAnim;
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + progress * 1.5;
        const dist = progress * pos.radius * 3.5;
        const fx = pos.x + Math.cos(angle) * dist;
        const fy = pos.y + Math.sin(angle) * dist + progress * progress * 40;
        const fragSize = pos.radius * (0.15 + (i % 3) * 0.08) * this.hitAnim;
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(angle + progress * 4);
        const colors = ['#e94560', '#fff', '#ffcc00', '#ff6b6b'];
        ctx.fillStyle = colors[i % 4];
        ctx.fillRect(-fragSize, -fragSize * 0.5, fragSize * 2, fragSize);
        ctx.restore();
      }
      // Sparks
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + progress * 3;
        const dist = progress * pos.radius * 4;
        const sx = pos.x + Math.cos(angle) * dist;
        const sy = pos.y + Math.sin(angle) * dist;
        const sparkSize = pos.radius * 0.1 * this.hitAnim;
        ctx.fillStyle = `rgba(255,200,50,${this.hitAnim * 0.8})`;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(1, sparkSize), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return;
    }

    if (pos.radius < 2) return;

    // Depth fog alpha
    const depthFade = Math.max(0.4, 1 - (this.z - MIN_Z) / (MAX_Z - MIN_Z) * 0.5);

    // === GROUND SHADOW (soft, elongated) ===
    const groundP = project(this.x, 0, this.z);
    ctx.globalAlpha = 0.25 * depthFade;
    const shadowGrad = ctx.createRadialGradient(groundP.x, groundP.y, 0, groundP.x, groundP.y, pos.radius * 1.2);
    shadowGrad.addColorStop(0, 'rgba(0,0,0,0.5)');
    shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(groundP.x + pos.radius * 0.3, groundP.y, pos.radius * 1.2, pos.radius * 0.25, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // === POLE (3D metallic) ===
    const poleW = Math.max(1.5, pos.scale * 5);
    const poleGrad = ctx.createLinearGradient(groundP.x - poleW, 0, groundP.x + poleW, 0);
    poleGrad.addColorStop(0, '#3a3a3a');
    poleGrad.addColorStop(0.3, '#666');
    poleGrad.addColorStop(0.5, '#888');
    poleGrad.addColorStop(0.7, '#666');
    poleGrad.addColorStop(1, '#2a2a2a');
    ctx.fillStyle = poleGrad;
    ctx.fillRect(groundP.x - poleW / 2, pos.y, poleW, groundP.y - pos.y);
    // Pole highlight
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(groundP.x - poleW / 4, pos.y, poleW / 4, groundP.y - pos.y);

    // === TARGET BACK RIM (3D depth illusion) ===
    const rimOffset = Math.max(2, pos.radius * 0.06);
    ctx.fillStyle = '#1a0a10';
    ctx.beginPath();
    ctx.arc(pos.x + rimOffset, pos.y + rimOffset, pos.radius + 2, 0, Math.PI * 2);
    ctx.fill();

    // === TARGET RINGS (with 3D shading) ===
    const ringColors = [
      ['#c83050', '#e94560'], // outer red
      ['#ddd', '#fff'],       // white
      ['#c83050', '#e94560'], // red
      ['#ddd', '#fff'],       // white
      ['#c83050', '#e94560']  // center red (bullseye)
    ];

    for (let i = 4; i >= 0; i--) {
      const ringR = pos.radius * ((i + 1) / 5);
      // Ring base with gradient
      const ringGrad = ctx.createRadialGradient(
        pos.x - ringR * 0.2, pos.y - ringR * 0.2, 0,
        pos.x, pos.y, ringR
      );
      ringGrad.addColorStop(0, ringColors[i][1]);
      ringGrad.addColorStop(0.7, ringColors[i][0]);
      ringGrad.addColorStop(1, ringColors[i][0]);
      ctx.fillStyle = ringGrad;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, ringR, 0, Math.PI * 2);
      ctx.fill();

      // Ring border (subtle groove between rings)
      if (i > 0) {
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = Math.max(0.5, pos.scale * 1.5);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, ringR, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // === 3D LIGHTING OVERLAY ===
    // Top-left highlight
    const hlGrad = ctx.createRadialGradient(
      pos.x - pos.radius * 0.3, pos.y - pos.radius * 0.3, 0,
      pos.x, pos.y, pos.radius
    );
    hlGrad.addColorStop(0, 'rgba(255,255,255,0.3)');
    hlGrad.addColorStop(0.4, 'rgba(255,255,255,0.08)');
    hlGrad.addColorStop(1, 'rgba(0,0,0,0.15)');
    ctx.fillStyle = hlGrad;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, pos.radius, 0, Math.PI * 2);
    ctx.fill();

    // Edge bevel (outer ring)
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = Math.max(1, pos.scale * 3);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, pos.radius, 0, Math.PI * 2);
    ctx.stroke();
    // Light edge highlight (top arc)
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = Math.max(0.5, pos.scale * 2);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, pos.radius - 1, -Math.PI * 0.8, -Math.PI * 0.2);
    ctx.stroke();

    // === BULLSEYE GLOW (pulsing) ===
    const pulseScale = 1 + Math.sin(Date.now() * 0.004) * 0.08;
    const bullR = pos.radius * 0.2 * pulseScale;
    ctx.globalAlpha = 0.4;
    const bullGlow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, bullR * 2);
    bullGlow.addColorStop(0, '#ff4060');
    bullGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = bullGlow;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, bullR * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // === POINT VALUE (styled badge) ===
    if (pos.radius > 14) {
      const badgeY = pos.y - pos.radius - 14 * pos.scale;
      const fontSize = Math.max(10, pos.radius * 0.4);
      const badgeW = fontSize * 2.2;
      const badgeH = fontSize * 1.3;
      // Badge background
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.roundRect(pos.x - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(233,69,96,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(pos.x - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 4);
      ctx.stroke();
      // Badge text
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${this.points}`, pos.x, badgeY);
    }

    // Apply depth fog
    if (depthFade < 0.9) {
      ctx.globalAlpha = (1 - depthFade) * 0.3;
      ctx.fillStyle = '#101828';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, pos.radius + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  hitTest(sx, sy) {
    if (!this.alive) return false;
    const pos = this.getScreenPos();
    const dx = sx - pos.x;
    const dy = sx !== undefined ? sy - pos.y : 0;
    return Math.sqrt(dx * dx + dy * dy) <= pos.radius;
  }
}

// Enhanced Particle system
class Particle {
  constructor(x, y, color, type = 'spark') {
    this.x = x;
    this.y = y;
    this.type = type;
    this.color = color;

    if (type === 'spark') {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 250;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed - 60;
      this.life = 0.5 + Math.random() * 0.7;
      this.size = 1.5 + Math.random() * 2.5;
      this.trail = [];
    } else if (type === 'smoke') {
      this.vx = (Math.random() - 0.5) * 30;
      this.vy = -20 - Math.random() * 40;
      this.life = 0.8 + Math.random() * 0.6;
      this.size = 5 + Math.random() * 10;
    } else if (type === 'ember') {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 80;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed - 30;
      this.life = 1 + Math.random() * 1;
      this.size = 1 + Math.random() * 1.5;
      this.flickerRate = 5 + Math.random() * 15;
    }
    this.maxLife = this.life;
  }
  update(dt) {
    if (this.type === 'spark') {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 4) this.trail.shift();
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.type === 'smoke') {
      this.vy -= 15 * dt;
      this.size += dt * 8;
    } else {
      this.vy += 250 * dt;
    }
    this.vx *= (1 - dt * 0.5);
    this.life -= dt * (1 / this.maxLife);
  }
  draw() {
    const lifeRatio = this.life / this.maxLife;
    if (this.type === 'spark') {
      // Draw trail
      if (this.trail.length > 1) {
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.size * lifeRatio * 0.5;
        ctx.globalAlpha = lifeRatio * 0.4;
        ctx.beginPath();
        ctx.moveTo(this.trail[0].x, this.trail[0].y);
        this.trail.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(this.x, this.y);
        ctx.stroke();
      }
      // Draw spark head with glow
      ctx.globalAlpha = lifeRatio;
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * lifeRatio, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (this.type === 'smoke') {
      ctx.globalAlpha = lifeRatio * 0.15;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'ember') {
      const flicker = 0.5 + 0.5 * Math.sin(Date.now() * 0.001 * this.flickerRate);
      ctx.globalAlpha = lifeRatio * flicker;
      ctx.fillStyle = this.color;
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * lifeRatio, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }
}

// Background rendering - enhanced with atmospheric effects
function drawBackground() {
  const time = Date.now() * 0.001;

  // === RICH SKY ===
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H * GROUND_Y);
  skyGrad.addColorStop(0, '#050520');
  skyGrad.addColorStop(0.25, '#0c1445');
  skyGrad.addColorStop(0.5, '#162050');
  skyGrad.addColorStop(0.75, '#1e3060');
  skyGrad.addColorStop(1, '#2a4570');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H * GROUND_Y + 5);

  // === STARS with color variation ===
  if (!drawBackground.stars) {
    drawBackground.stars = [];
    for (let i = 0; i < 150; i++) {
      drawBackground.stars.push({
        x: Math.random(), y: Math.random() * 0.65,
        s: 0.3 + Math.random() * 2,
        b: 0.2 + Math.random() * 0.8,
        spd: 0.5 + Math.random() * 3,
        hue: Math.random() > 0.8 ? (Math.random() > 0.5 ? '#ffd4a0' : '#a0c4ff') : '#fff'
      });
    }
  }
  drawBackground.stars.forEach(s => {
    const twinkle = 0.4 + 0.6 * Math.sin(time * s.spd + s.x * 100);
    const alpha = s.b * twinkle * 0.7;
    const sx = s.x * W, sy = s.y * H * GROUND_Y;
    ctx.fillStyle = s.hue;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(sx, sy, s.s, 0, Math.PI * 2);
    ctx.fill();
    // Star glow
    if (s.s > 1.2) {
      ctx.globalAlpha = alpha * 0.15;
      ctx.beginPath();
      ctx.arc(sx, sy, s.s * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.globalAlpha = 1;

  // === MOON ===
  const moonX = W * 0.18, moonY = H * 0.12, moonR = 35;
  const moonGrad = ctx.createRadialGradient(moonX - 5, moonY - 5, 0, moonX, moonY, moonR);
  moonGrad.addColorStop(0, '#fffde8');
  moonGrad.addColorStop(0.6, '#e8e0c0');
  moonGrad.addColorStop(1, '#c8b888');
  ctx.fillStyle = moonGrad;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.fill();
  // Moon glow
  ctx.globalAlpha = 0.06;
  const moonGlow = ctx.createRadialGradient(moonX, moonY, moonR, moonX, moonY, moonR * 5);
  moonGlow.addColorStop(0, '#fffde8');
  moonGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = moonGlow;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR * 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // Moon craters
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#a09070';
  [[8, -6, 5], [-10, 4, 7], [5, 10, 4], [-3, -10, 3], [12, 3, 3]].forEach(([dx, dy, r]) => {
    ctx.beginPath();
    ctx.arc(moonX + dx, moonY + dy, r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // === NEBULA / AURORA hints ===
  ctx.globalAlpha = 0.03;
  const nebulaGrad = ctx.createRadialGradient(W * 0.7, H * 0.15, 0, W * 0.7, H * 0.15, W * 0.3);
  nebulaGrad.addColorStop(0, '#6644aa');
  nebulaGrad.addColorStop(0.5, '#4422aa');
  nebulaGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = nebulaGrad;
  ctx.fillRect(0, 0, W, H * GROUND_Y);
  ctx.globalAlpha = 1;

  // === FAR MOUNTAINS (layered parallax) ===
  // Layer 1 - distant, blue
  ctx.fillStyle = '#0a1525';
  ctx.beginPath();
  ctx.moveTo(0, H * GROUND_Y);
  for (let x = 0; x <= W; x += 15) {
    const mh = Math.sin(x * 0.002 + 0.5) * 80 + Math.sin(x * 0.005) * 40 + Math.sin(x * 0.013 + 2) * 20;
    ctx.lineTo(x, H * GROUND_Y - mh - 40);
  }
  ctx.lineTo(W, H * GROUND_Y);
  ctx.fill();

  // Layer 2 - mid, slightly lighter
  ctx.fillStyle = '#0d1e30';
  ctx.beginPath();
  ctx.moveTo(0, H * GROUND_Y);
  for (let x = 0; x <= W; x += 15) {
    const mh = Math.sin(x * 0.003 + 1) * 55 + Math.sin(x * 0.008 + 2) * 25 + Math.sin(x * 0.018) * 12;
    ctx.lineTo(x, H * GROUND_Y - mh - 15);
  }
  ctx.lineTo(W, H * GROUND_Y);
  ctx.fill();

  // Mountain snow caps hint
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(0, H * GROUND_Y);
  for (let x = 0; x <= W; x += 15) {
    const mh = Math.sin(x * 0.002 + 0.5) * 80 + Math.sin(x * 0.005) * 40 + Math.sin(x * 0.013 + 2) * 20;
    const peak = H * GROUND_Y - mh - 40;
    ctx.lineTo(x, peak);
  }
  ctx.lineTo(W, H * GROUND_Y - 80);
  ctx.lineTo(W, H * GROUND_Y);
  ctx.fill();
  ctx.globalAlpha = 1;

  // === TREE LINE silhouette ===
  ctx.fillStyle = '#081510';
  for (let x = -10; x < W + 20; x += 18 + Math.sin(x * 0.1) * 8) {
    const treeH = 20 + Math.sin(x * 0.05 + 1) * 12 + Math.sin(x * 0.13) * 6;
    const baseY = H * GROUND_Y + 2;
    // Triangle tree
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x + 6 + Math.random() * 3, baseY - treeH);
    ctx.lineTo(x + 14, baseY);
    ctx.fill();
  }

  // === GROUND ===
  const groundGrad = ctx.createLinearGradient(0, H * GROUND_Y, 0, H);
  groundGrad.addColorStop(0, '#2a4535');
  groundGrad.addColorStop(0.15, '#223a2e');
  groundGrad.addColorStop(0.4, '#1a3025');
  groundGrad.addColorStop(0.7, '#12241a');
  groundGrad.addColorStop(1, '#0a1610');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, H * GROUND_Y, W, H * (1 - GROUND_Y));

  // === GROUND TEXTURE (dirt/grass variation) ===
  if (!drawBackground.groundNoise) {
    drawBackground.groundNoise = [];
    for (let i = 0; i < 120; i++) {
      drawBackground.groundNoise.push({
        x: Math.random(), z: MIN_Z + Math.random() * (MAX_Z - MIN_Z),
        shade: Math.random(), size: 0.3 + Math.random() * 0.7
      });
    }
  }
  drawBackground.groundNoise.forEach(g => {
    const px = (g.x - 0.5) * g.z * 3;
    const p = project(px, 0, g.z);
    const dotSize = Math.max(1, p.scale * g.size * 4);
    ctx.globalAlpha = 0.04 + g.shade * 0.04;
    ctx.fillStyle = g.shade > 0.5 ? '#3a5a40' : '#1a2a18';
    ctx.beginPath();
    ctx.arc(p.x, p.y + 2, dotSize, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // === HORIZON GLOW (warm) ===
  const hGrad = ctx.createLinearGradient(0, H * GROUND_Y - 50, 0, H * GROUND_Y + 50);
  hGrad.addColorStop(0, 'rgba(40,60,100,0)');
  hGrad.addColorStop(0.4, 'rgba(233,69,96,0.06)');
  hGrad.addColorStop(0.5, 'rgba(255,140,80,0.08)');
  hGrad.addColorStop(0.6, 'rgba(233,69,96,0.06)');
  hGrad.addColorStop(1, 'rgba(40,60,100,0)');
  ctx.fillStyle = hGrad;
  ctx.fillRect(0, H * GROUND_Y - 50, W, 100);

  // === PERSPECTIVE GRID with fade ===
  for (let z = MIN_Z; z <= MAX_Z; z += 1.5) {
    const p1 = project(-z * 2, 0, z);
    const p2 = project(z * 2, 0, z);
    const fade = 1 - (z - MIN_Z) / (MAX_Z - MIN_Z);
    ctx.strokeStyle = `rgba(255,255,255,${0.015 + fade * 0.025})`;
    ctx.lineWidth = Math.max(0.5, fade * 1.5);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // Converging vertical grid lines
  for (let i = -6; i <= 6; i++) {
    const nearP = project(i * 1.2, 0, MIN_Z);
    const farP = project(i * 1.2, 0, MAX_Z);
    ctx.strokeStyle = 'rgba(255,255,255,0.015)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(nearP.x, nearP.y);
    ctx.lineTo(farP.x, farP.y);
    ctx.stroke();
  }

  // === DISTANCE MARKERS (range posts) ===
  for (let z = 4; z <= MAX_Z; z += 4) {
    const postX = -z * 1.0;
    const pBase = project(postX, 0, z);
    const pTop = project(postX, 0.6, z);
    const postW = Math.max(2, pBase.scale * 6);

    // Post shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(pBase.x + postW, pBase.y, postW * 2, postW * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wooden post
    const postGrad = ctx.createLinearGradient(pBase.x - postW / 2, 0, pBase.x + postW / 2, 0);
    postGrad.addColorStop(0, '#3a2810');
    postGrad.addColorStop(0.3, '#5a3c18');
    postGrad.addColorStop(0.7, '#4a3015');
    postGrad.addColorStop(1, '#2a1808');
    ctx.fillStyle = postGrad;
    ctx.fillRect(pBase.x - postW / 2, pTop.y, postW, pBase.y - pTop.y);

    // Distance sign
    const signH = Math.max(8, pBase.scale * 18);
    const signW = Math.max(16, pBase.scale * 35);
    const signY = pTop.y + 2;
    // Sign background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(pBase.x - signW / 2, signY, signW, signH);
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = Math.max(1, pBase.scale * 2);
    ctx.strokeRect(pBase.x - signW / 2, signY, signW, signH);
    // Sign text
    if (signH > 6) {
      ctx.fillStyle = '#e94560';
      ctx.font = `bold ${Math.max(7, signH * 0.65)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(z * 5)}m`, pBase.x, signY + signH / 2);
    }
  }

  // === FENCE POSTS on right side ===
  for (let z = MIN_Z; z <= MAX_Z; z += 2.5) {
    const fenceX = z * 1.15;
    const fBase = project(fenceX, 0, z);
    const fTop = project(fenceX, 0.5, z);
    const fw = Math.max(1.5, fBase.scale * 4);

    ctx.fillStyle = '#2a1c0c';
    ctx.fillRect(fBase.x - fw / 2, fTop.y, fw, fBase.y - fTop.y);
    // Post top cap
    ctx.fillStyle = '#3a2a14';
    ctx.beginPath();
    ctx.arc(fBase.x, fTop.y, fw * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  // Fence wire
  ctx.strokeStyle = 'rgba(120,120,120,0.15)';
  ctx.lineWidth = 0.8;
  [0.2, 0.35].forEach(wireH => {
    ctx.beginPath();
    let first = true;
    for (let z = MIN_Z; z <= MAX_Z; z += 2.5) {
      const fenceX = z * 1.15;
      const p = project(fenceX, wireH, z);
      if (first) { ctx.moveTo(p.x, p.y); first = false; }
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  });

  // === ATMOSPHERIC FOG at distance ===
  const fogGrad = ctx.createLinearGradient(0, H * GROUND_Y - 60, 0, H * GROUND_Y + 30);
  fogGrad.addColorStop(0, 'rgba(15,25,45,0)');
  fogGrad.addColorStop(0.5, 'rgba(15,25,45,0.12)');
  fogGrad.addColorStop(1, 'rgba(15,25,45,0)');
  ctx.fillStyle = fogGrad;
  ctx.fillRect(0, H * GROUND_Y - 60, W, 90);
}

// Enhanced Crosshair with holographic feel
function drawCrosshair() {
  const cx = mouseX;
  const cy = mouseY;
  const time = Date.now() * 0.001;

  // Check if aiming at any target
  let aimingAt = null;
  if (aimAssist && gameRunning) {
    let closest = Infinity;
    targets.forEach(t => {
      if (!t.alive) return;
      const pos = t.getScreenPos();
      const dist = Math.sqrt((cx - pos.x) ** 2 + (cy - pos.y) ** 2);
      if (dist < pos.radius * 1.8 && dist < closest) {
        closest = dist;
        aimingAt = t;
      }
    });
  }

  const isAiming = aimingAt !== null;
  const baseColor = isAiming ? '#00ff88' : '#e94560';
  const size = isAiming ? 24 : 20;

  // Outer glow
  ctx.shadowColor = baseColor;
  ctx.shadowBlur = isAiming ? 20 : 10;

  // Rotating outer ring
  ctx.strokeStyle = baseColor;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.arc(cx, cy, size + 6, time * 0.5, time * 0.5 + Math.PI * 1.5);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Main circle
  ctx.strokeStyle = baseColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, size, 0, Math.PI * 2);
  ctx.stroke();

  // Inner circle
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Cross lines with chevron ends
  const gap = 7;
  const len = size + 10;
  ctx.lineWidth = 2;
  ctx.beginPath();
  // Left
  ctx.moveTo(cx - len - 3, cy); ctx.lineTo(cx - gap, cy);
  // Right
  ctx.moveTo(cx + gap, cy); ctx.lineTo(cx + len + 3, cy);
  // Top
  ctx.moveTo(cx, cy - len - 3); ctx.lineTo(cx, cy - gap);
  // Bottom
  ctx.moveTo(cx, cy + gap); ctx.lineTo(cx, cy + len + 3);
  ctx.stroke();

  // Tick marks on cross lines
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.4;
  [0.4, 0.7].forEach(r => {
    const d = size * r;
    // Small perpendicular ticks
    ctx.beginPath();
    ctx.moveTo(cx - d, cy - 3); ctx.lineTo(cx - d, cy + 3);
    ctx.moveTo(cx + d, cy - 3); ctx.lineTo(cx + d, cy + 3);
    ctx.moveTo(cx - 3, cy - d); ctx.lineTo(cx + 3, cy - d);
    ctx.moveTo(cx - 3, cy + d); ctx.lineTo(cx + 3, cy + d);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;

  // Center dot with glow
  ctx.fillStyle = baseColor;
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Corner brackets (holographic style)
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.6;
  const br = size + 14;
  const bl = 6;
  // Top-left
  ctx.beginPath();
  ctx.moveTo(cx - br, cy - br + bl); ctx.lineTo(cx - br, cy - br); ctx.lineTo(cx - br + bl, cy - br);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(cx + br - bl, cy - br); ctx.lineTo(cx + br, cy - br); ctx.lineTo(cx + br, cy - br + bl);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(cx - br, cy + br - bl); ctx.lineTo(cx - br, cy + br); ctx.lineTo(cx - br + bl, cy + br);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(cx + br - bl, cy + br); ctx.lineTo(cx + br, cy + br); ctx.lineTo(cx + br, cy + br - bl);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Aim assist - draw line to target
  if (isAiming && aimAssist) {
    const pos = aimingAt.getScreenPos();
    const dist = Math.sqrt((cx - pos.x) ** 2 + (cy - pos.y) ** 2);
    const alpha = Math.max(0, 1 - dist / (pos.radius * 1.8));

    // Diamond lock indicator around target
    ctx.strokeStyle = `rgba(0, 255, 136, ${alpha * 0.6})`;
    ctx.lineWidth = 1.5;
    const lockR = pos.radius * 1.3;
    const lockRot = time * 1.5;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = lockRot + (i / 4) * Math.PI * 2;
      const lx = pos.x + Math.cos(a) * lockR;
      const ly = pos.y + Math.sin(a) * lockR;
      if (i === 0) ctx.moveTo(lx, ly);
      else ctx.lineTo(lx, ly);
    }
    ctx.closePath();
    ctx.stroke();

    // Dashed line to target
    ctx.strokeStyle = `rgba(0, 255, 136, ${alpha * 0.25})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Info panel
    ctx.globalAlpha = alpha * 0.85;
    const panelX = cx + size + 14;
    const panelY = cy - 18;
    ctx.fillStyle = 'rgba(0,20,10,0.7)';
    ctx.beginPath();
    ctx.roundRect(panelX - 4, panelY - 10, 65, 34, 3);
    ctx.fill();
    ctx.strokeStyle = `rgba(0,255,136,0.4)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX - 4, panelY - 10, 65, 34, 3);
    ctx.stroke();
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${aimingAt.points} PTS`, panelX + 2, panelY + 2);
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(0,255,136,0.7)';
    ctx.fillText(`${Math.round(aimingAt.z * 5)}m`, panelX + 2, panelY + 16);
    ctx.globalAlpha = 1;
  }

  ctx.shadowBlur = 0;

  // Muzzle flash at crosshair
  if (muzzleFlash > 0) {
    ctx.globalAlpha = muzzleFlash * 0.6;
    const flashGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 50);
    flashGrad.addColorStop(0, 'rgba(255,220,80,0.9)');
    flashGrad.addColorStop(0.3, 'rgba(255,120,20,0.4)');
    flashGrad.addColorStop(0.6, 'rgba(255,60,10,0.1)');
    flashGrad.addColorStop(1, 'rgba(255,40,0,0)');
    ctx.fillStyle = flashGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// Draw FPS gun - clean rifle body only, no hands
// Perspective foreshortening: near end (right) wider, far end (muzzle, left) narrower
function drawGun(dt) {
  if (!drawGun.smoothX) { drawGun.smoothX = W * 0.72; drawGun.smoothY = H * 0.78; }
  const swayX = (mouseX - W / 2) / W * 10;
  const swayY = (mouseY - H / 2) / H * 5;
  drawGun.smoothX += (W * 0.72 + swayX - drawGun.smoothX) * 0.08;
  drawGun.smoothY += (H * 0.78 + swayY * 0.2 - drawGun.smoothY) * 0.08;

  const breathe = Math.sin(Date.now() * 0.0015) * 1.2;
  const breatheX = Math.sin(Date.now() * 0.001) * 0.6;
  const bx = drawGun.smoothX + breatheX;
  const by = drawGun.smoothY + breathe;

  if (gunRecoil > 0) gunRecoil = Math.max(0, gunRecoil - dt * 5);
  const rKick = gunRecoil * 14;
  const rUp = gunRecoil * 6;
  const rRot = gunRecoil * 0.04;

  const s = Math.max(0.5, Math.min(W, H) / 700);

  ctx.save();
  ctx.translate(bx + rKick, by - rUp);
  ctx.rotate(-0.06 - rRot);

  function metalGrad(y1, y2, base, hi, shadow) {
    const g = ctx.createLinearGradient(0, y1 * s, 0, y2 * s);
    g.addColorStop(0, hi); g.addColorStop(0.3, base);
    g.addColorStop(0.7, base); g.addColorStop(1, shadow);
    return g;
  }

  // ── BARREL (perspective trapezoid: narrows toward muzzle) ──
  const mn = 0.55;
  ctx.fillStyle = metalGrad(-10, 10, '#3a3a3a', '#555', '#1e1e1e');
  ctx.beginPath();
  ctx.moveTo(-310*s, -8*mn*s);
  ctx.lineTo(-115*s, -12*s);
  ctx.lineTo(-115*s, 12*s);
  ctx.lineTo(-310*s, 8*mn*s);
  ctx.closePath();
  ctx.fill();
  // Barrel top highlight
  ctx.strokeStyle = 'rgba(140,140,140,0.25)';
  ctx.lineWidth = 0.8*s;
  ctx.beginPath(); ctx.moveTo(-310*s, -8*mn*s); ctx.lineTo(-115*s, -12*s); ctx.stroke();

  // Muzzle end
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath(); ctx.ellipse(-312*s, 0, 7*s, 8*s, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath(); ctx.ellipse(-312*s, 0, 4*s, 5*s, 0, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#444'; ctx.lineWidth = 1*s;
  ctx.beginPath(); ctx.ellipse(-312*s, 0, 6*s, 7*s, 0, 0, Math.PI*2); ctx.stroke();

  // Flash hider grooves
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = 'rgba(60,60,60,0.5)'; ctx.lineWidth = 1.2*s;
    ctx.beginPath(); ctx.moveTo((-305+i*6)*s, -6*s); ctx.lineTo((-305+i*6)*s, 6*s); ctx.stroke();
  }

  // ── HANDGUARD ──
  ctx.fillStyle = metalGrad(-18, 18, '#2a2a2a', '#3e3e3e', '#141414');
  ctx.beginPath();
  ctx.moveTo(-260*s, -14*s); ctx.lineTo(-115*s, -18*s);
  ctx.lineTo(-115*s, 18*s); ctx.lineTo(-260*s, 14*s);
  ctx.closePath();
  ctx.fill();

  // Heat vents
  for (let i = 0; i < 5; i++) {
    const hx = (-245 + i*24) * s;
    const sc = 1.0 - ((-245+i*24)+260)/200*0.15;
    ctx.fillStyle = 'rgba(8,8,8,0.45)';
    ctx.beginPath(); ctx.ellipse(hx, 0, 3.5*s*sc, 7*s*sc, 0, 0, Math.PI*2); ctx.fill();
  }

  // Picatinny rail
  ctx.fillStyle = '#363636';
  for (let i = 0; i < 11; i++) ctx.fillRect((-255+i*12)*s, -20*s, 5*s, 3*s);

  // ── UPPER RECEIVER ──
  ctx.fillStyle = metalGrad(-22, 22, '#333', '#484848', '#181818');
  ctx.beginPath();
  ctx.moveTo(-115*s, -20*s); ctx.lineTo(42*s, -20*s);
  ctx.lineTo(46*s, -16*s); ctx.lineTo(46*s, 16*s); ctx.lineTo(-115*s, 20*s);
  ctx.closePath();
  ctx.fill();

  // Receiver top surface
  ctx.fillStyle = '#484848';
  ctx.fillRect(-115*s, -22*s, 160*s, 3*s);

  // Ejection port
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(-50*s, -20*s, 40*s, 11*s);
  ctx.strokeStyle = '#3e3e3e'; ctx.lineWidth = 0.7*s;
  ctx.strokeRect(-50*s, -20*s, 40*s, 11*s);

  // Charging handle
  ctx.fillStyle = '#4a4a4a'; ctx.fillRect(-5*s, -23*s, 20*s, 4*s);
  ctx.fillStyle = '#333'; ctx.fillRect(-2*s, -25*s, 8*s, 3*s);

  // Rear serrations
  for (let i = 0; i < 5; i++) {
    const sx = (15+i*5)*s;
    ctx.strokeStyle = 'rgba(15,15,15,0.5)'; ctx.lineWidth = 1.8*s;
    ctx.beginPath(); ctx.moveTo(sx,-18*s); ctx.lineTo(sx,14*s); ctx.stroke();
    ctx.strokeStyle = 'rgba(80,80,80,0.15)'; ctx.lineWidth = 0.6*s;
    ctx.beginPath(); ctx.moveTo(sx+1.5*s,-18*s); ctx.lineTo(sx+1.5*s,14*s); ctx.stroke();
  }

  // Specular highlight
  ctx.globalAlpha = 0.05; ctx.fillStyle = '#fff';
  ctx.fillRect(-115*s, -20*s, 160*s, 7*s); ctx.globalAlpha = 1;

  // ── TRIGGER GUARD ──
  ctx.strokeStyle = '#2e2e2e'; ctx.lineWidth = 3.5*s; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-25*s, 20*s); ctx.lineTo(-25*s, 42*s);
  ctx.quadraticCurveTo(-25*s, 55*s, -10*s, 55*s);
  ctx.quadraticCurveTo(10*s, 55*s, 10*s, 38*s);
  ctx.lineTo(10*s, 20*s);
  ctx.stroke(); ctx.lineCap = 'butt';

  // Trigger
  ctx.fillStyle = '#888';
  ctx.beginPath();
  ctx.moveTo(-12*s, 25*s); ctx.lineTo(-8*s, 25*s);
  ctx.lineTo(-6*s, 42*s); ctx.quadraticCurveTo(-9*s, 46*s, -12*s, 42*s);
  ctx.closePath(); ctx.fill();

  // ── PISTOL GRIP ──
  ctx.fillStyle = metalGrad(18, 110, '#1c1c1c', '#282828', '#0e0e0e');
  ctx.beginPath();
  ctx.moveTo(5*s,18*s); ctx.lineTo(42*s,16*s); ctx.lineTo(58*s,50*s);
  ctx.lineTo(68*s,110*s); ctx.lineTo(55*s,118*s); ctx.lineTo(18*s,115*s); ctx.lineTo(0*s,58*s);
  ctx.closePath(); ctx.fill();

  // Grip texture
  ctx.strokeStyle = 'rgba(50,50,50,0.35)'; ctx.lineWidth = 0.6*s;
  for (let i = 0; i < 9; i++) {
    const gy=(30+i*9)*s;
    ctx.beginPath(); ctx.moveTo((12+i)*s,gy); ctx.lineTo((50+i*1.5)*s,gy); ctx.stroke();
  }
  for (let i = 0; i < 6; i++) {
    const gx=(18+i*8)*s;
    ctx.beginPath(); ctx.moveTo(gx,28*s); ctx.lineTo((gx+8)*s,110*s); ctx.stroke();
  }

  // Magazine base
  ctx.fillStyle = '#363636';
  ctx.beginPath();
  ctx.moveTo(20*s,112*s); ctx.lineTo(57*s,116*s);
  ctx.lineTo(58*s,124*s); ctx.lineTo(19*s,120*s);
  ctx.closePath(); ctx.fill();

  // ── SIGHTS ──
  // Rear sight
  ctx.fillStyle = '#444';
  ctx.fillRect(32*s,-26*s,4*s,7*s); ctx.fillRect(42*s,-26*s,4*s,7*s);
  ctx.fillStyle = 'rgba(200,255,200,0.5)';
  ctx.beginPath(); ctx.arc(34*s,-22*s,1.2*s,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(44*s,-22*s,1.2*s,0,Math.PI*2); ctx.fill();

  // Front sight + tritium
  ctx.fillStyle = '#3a3a3a'; ctx.fillRect(-258*s,-22*s,5*s,5*s);
  ctx.fillStyle = '#e94560'; ctx.shadowColor = '#e94560'; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.arc(-255.5*s,-19.5*s,1.8*s,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha = 0.3;
  ctx.beginPath(); ctx.arc(-255.5*s,-19.5*s,4.5*s,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;

  // ── STOCK ──
  ctx.fillStyle = metalGrad(-16,16,'#2a2a2a','#3a3a3a','#151515');
  ctx.beginPath();
  ctx.moveTo(46*s,-16*s); ctx.lineTo(130*s,-14*s); ctx.lineTo(135*s,-10*s);
  ctx.lineTo(135*s,10*s); ctx.lineTo(130*s,14*s); ctx.lineTo(46*s,16*s);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#222'; ctx.fillRect(130*s,-12*s,6*s,24*s);
  ctx.fillStyle = '#3a3a3a'; ctx.fillRect(46*s,-8*s,90*s,16*s);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = 'rgba(10,10,10,0.3)';
    ctx.beginPath(); ctx.arc((65+i*18)*s,0,2.5*s,0,Math.PI*2); ctx.fill();
  }

  // ── OVERALL SPECULAR ──
  ctx.globalAlpha = 0.03;
  const gunHL = ctx.createLinearGradient(-300*s,-20*s,60*s,20*s);
  gunHL.addColorStop(0,'#fff'); gunHL.addColorStop(0.4,'#fff');
  gunHL.addColorStop(0.6,'transparent'); gunHL.addColorStop(1,'transparent');
  ctx.fillStyle = gunHL;
  ctx.fillRect(-315*s,-25*s,460*s,50*s);
  ctx.globalAlpha = 1;

  // ── MUZZLE FLASH ──
  if (muzzleFlash > 0.3) {
    const fa = (muzzleFlash - 0.3) / 0.7;
    ctx.globalAlpha = fa;
    const fx = -325*s, fs = Math.max(1, 70*s*fa);

    const fGrad = ctx.createRadialGradient(fx,0,0,fx,0,fs);
    fGrad.addColorStop(0,'rgba(255,255,220,0.95)');
    fGrad.addColorStop(0.15,'rgba(255,220,80,0.8)');
    fGrad.addColorStop(0.4,'rgba(255,140,30,0.4)');
    fGrad.addColorStop(0.7,'rgba(255,80,10,0.15)');
    fGrad.addColorStop(1,'rgba(255,40,0,0)');
    ctx.fillStyle = fGrad;
    ctx.beginPath(); ctx.arc(fx,0,fs,0,Math.PI*2); ctx.fill();

    ctx.strokeStyle = `rgba(255,230,120,${fa*0.5})`; ctx.lineWidth = 2*s;
    for (let i = 0; i < 5; i++) {
      const a = Math.PI+(i-2)*0.35+(Math.random()-0.5)*0.2;
      const sl = fs*(0.5+Math.random()*0.5);
      ctx.beginPath(); ctx.moveTo(fx,0);
      ctx.lineTo(fx+Math.cos(a)*sl, Math.sin(a)*sl); ctx.stroke();
    }

    ctx.globalAlpha = fa*0.1; ctx.fillStyle = '#999';
    for (let i = 0; i < 3; i++) {
      const sx = fx-12*s*i-Math.random()*8*s;
      ctx.beginPath(); ctx.arc(sx,(Math.random()-0.5)*10*s,(5+i*3)*s,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

<<<<<<< ours
<<<<<<< ours
=======
function drawGunFacingRange(dt) {
  if (!drawGunFacingRange.smoothX) {
    drawGunFacingRange.smoothX = W * 0.79;
    drawGunFacingRange.smoothY = H * 0.79;
=======
function drawGunFacingRange(dt) {
  if (!drawGunFacingRange.smoothX) {
    drawGunFacingRange.smoothX = W * 0.82;
    drawGunFacingRange.smoothY = H * 0.86;
>>>>>>> theirs
  }

  const aimDX = (mouseX - W / 2) / W;
  const aimDY = (mouseY - H / 2) / H;
  const swayX = aimDX * 26;
  const swayY = aimDY * 18;
<<<<<<< ours
  drawGunFacingRange.smoothX += (W * 0.79 + swayX * 0.75 - drawGunFacingRange.smoothX) * 0.08;
  drawGunFacingRange.smoothY += (H * 0.79 + swayY * 0.18 - drawGunFacingRange.smoothY) * 0.08;
=======
  drawGunFacingRange.smoothX += (W * 0.82 + swayX - drawGunFacingRange.smoothX) * 0.08;
  drawGunFacingRange.smoothY += (H * 0.86 + swayY * 0.3 - drawGunFacingRange.smoothY) * 0.08;
>>>>>>> theirs

  const now = Date.now();
  const breathe = Math.sin(now * 0.0016) * 1.5;
  const breatheX = Math.sin(now * 0.0011) * 0.8;
  const bx = drawGunFacingRange.smoothX + breatheX;
  const by = drawGunFacingRange.smoothY + breathe;

  if (gunRecoil > 0) gunRecoil = Math.max(0, gunRecoil - dt * 5);
<<<<<<< ours
  const recoilBack = gunRecoil * 14;
  const recoilLift = gunRecoil * 6;
  const recoilRoll = gunRecoil * 0.028;
=======
  const recoilBack = gunRecoil * 18;
  const recoilDrop = gunRecoil * 8;
  const recoilRoll = gunRecoil * 0.035;
>>>>>>> theirs

  const s = Math.max(0.5, Math.min(W, H) / 700);

  ctx.save();
<<<<<<< ours
  ctx.translate(bx + recoilBack, by - recoilLift);
  ctx.rotate(0.34 + aimDX * 0.12 + aimDY * 0.04 + recoilRoll);
=======
  ctx.translate(bx + recoilBack, by + recoilDrop);
  ctx.rotate(-0.42 + aimDX * 0.18 - aimDY * 0.05 + recoilRoll);
>>>>>>> theirs
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  function makeGradient(x1, y1, x2, y2, stops) {
    const g = ctx.createLinearGradient(x1 * s, y1 * s, x2 * s, y2 * s);
    stops.forEach(([stop, color]) => g.addColorStop(stop, color));
    return g;
  }

  function fillPoly(points, fillStyle, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    points.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x * s, y * s);
      else ctx.lineTo(x * s, y * s);
    });
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(-18 * s, 76 * s, 215 * s, 40 * s, 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const barrelGrad = makeGradient(-260, -20, 40, 38, [
    [0, '#101010'],
    [0.28, '#595959'],
    [0.58, '#2e2e2e'],
    [1, '#080808']
  ]);
  fillPoly([
    [-252, -12],
    [-90, -16],
    [-72, -9],
    [-70, 2],
    [-252, 4]
  ], barrelGrad);

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.moveTo(-248 * s, -10 * s);
  ctx.lineTo(-88 * s, -13 * s);
  ctx.stroke();

  ctx.fillStyle = '#202020';
  ctx.beginPath();
  ctx.ellipse(-260 * s, -4 * s, 10 * s, 8 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#050505';
  ctx.beginPath();
  ctx.ellipse(-260 * s, -4 * s, 5 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#585858';
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.ellipse(-260 * s, -4 * s, 8 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(80,80,80,0.7)';
  ctx.lineWidth = 1.3 * s;
  [-255, -249, -243].forEach(x => {
    ctx.beginPath();
    ctx.moveTo(x * s, -10 * s);
    ctx.lineTo(x * s, 1 * s);
    ctx.stroke();
  });

  const handguardGrad = makeGradient(-240, -32, 30, 42, [
    [0, '#181818'],
    [0.24, '#414141'],
    [0.68, '#242424'],
    [1, '#0b0b0b']
  ]);
  fillPoly([
    [-230, -24],
    [-92, -30],
    [-72, -22],
    [-70, 18],
    [-96, 26],
    [-230, 16]
  ], handguardGrad);
  fillPoly([
    [-226, -24],
    [-92, -30],
    [-74, -23],
    [-95, -16],
    [-224, -13]
  ], makeGradient(-226, -26, -70, -14, [
    [0, 'rgba(122,122,122,0.65)'],
    [0.45, 'rgba(82,82,82,0.38)'],
    [1, 'rgba(20,20,20,0.15)']
  ]), 0.9);

  ctx.fillStyle = 'rgba(8,8,8,0.45)';
  for (let i = 0; i < 6; i++) {
    const vx = (-212 + i * 22) * s;
    ctx.beginPath();
    ctx.ellipse(vx, 1 * s, 4 * s, 8 * s, -0.08, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#2b2b2b';
  for (let i = 0; i < 9; i++) {
    ctx.fillRect((-218 + i * 17) * s, -34 * s, 8 * s, 4 * s);
  }

  ctx.fillStyle = '#3d3d3d';
  ctx.fillRect(-184 * s, -38 * s, 12 * s, 18 * s);
  ctx.fillStyle = '#e94560';
  ctx.shadowColor = '#e94560';
  ctx.shadowBlur = 8 * s;
  ctx.beginPath();
  ctx.arc(-178 * s, -29 * s, 2.2 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  const receiverGrad = makeGradient(-90, -36, 85, 40, [
    [0, '#1e1e1e'],
    [0.25, '#515151'],
    [0.72, '#2c2c2c'],
    [1, '#101010']
  ]);
  fillPoly([
    [-84, -34],
    [28, -28],
    [58, -10],
    [60, 28],
    [26, 40],
    [-74, 32],
    [-92, 12]
  ], receiverGrad);
  fillPoly([
    [-84, -34],
    [26, -28],
    [44, -18],
    [10, -12],
    [-88, -18]
  ], makeGradient(-84, -34, 44, -12, [
    [0, '#666'],
    [0.4, '#8a8a8a'],
    [1, '#343434']
  ]), 0.95);

  fillPoly([
    [-18, -12],
    [18, -10],
    [19, 5],
    [-16, 6]
  ], '#0a0a0a');
  ctx.strokeStyle = '#4a4a4a';
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.moveTo(-18 * s, -12 * s);
  ctx.lineTo(18 * s, -10 * s);
  ctx.lineTo(19 * s, 5 * s);
  ctx.lineTo(-16 * s, 6 * s);
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = '#4d4d4d';
  ctx.fillRect(12 * s, -30 * s, 18 * s, 4 * s);
  ctx.fillStyle = '#303030';
  for (let i = 0; i < 5; i++) {
    const sx = (22 + i * 6) * s;
    ctx.beginPath();
    ctx.moveTo(sx, -18 * s);
    ctx.lineTo(sx, 18 * s);
    ctx.lineWidth = 1.4 * s;
    ctx.strokeStyle = 'rgba(24,24,24,0.55)';
    ctx.stroke();
  }

  const opticGrad = makeGradient(-30, -56, 22, -18, [
    [0, '#2c2c2c'],
    [0.35, '#626262'],
    [1, '#181818']
  ]);
  fillPoly([
    [-24, -52],
    [8, -50],
    [20, -28],
    [-14, -26]
  ], opticGrad);
  fillPoly([
    [-16, -58],
    [4, -56],
    [8, -50],
    [-12, -51]
  ], '#505050');
  ctx.fillStyle = 'rgba(170,255,220,0.42)';
  ctx.fillRect(-7 * s, -44 * s, 14 * s, 8 * s);

  ctx.strokeStyle = '#252525';
  ctx.lineWidth = 4 * s;
  ctx.beginPath();
  ctx.moveTo(4 * s, 28 * s);
  ctx.quadraticCurveTo(-10 * s, 48 * s, 4 * s, 64 * s);
  ctx.quadraticCurveTo(24 * s, 76 * s, 40 * s, 60 * s);
  ctx.lineTo(48 * s, 38 * s);
  ctx.stroke();

  ctx.fillStyle = '#919191';
  ctx.beginPath();
  ctx.moveTo(18 * s, 34 * s);
  ctx.lineTo(24 * s, 34 * s);
  ctx.lineTo(28 * s, 53 * s);
  ctx.quadraticCurveTo(23 * s, 60 * s, 17 * s, 54 * s);
  ctx.closePath();
  ctx.fill();

  const gripGrad = makeGradient(8, 20, 92, 166, [
    [0, '#1f1f1f'],
    [0.35, '#4b4b4b'],
    [1, '#101010']
  ]);
  fillPoly([
    [12, 28],
    [52, 34],
    [78, 84],
    [80, 150],
    [58, 164],
    [28, 154],
    [8, 92]
  ], gripGrad);

  ctx.strokeStyle = 'rgba(50,50,50,0.35)';
  ctx.lineWidth = 0.8 * s;
  for (let i = 0; i < 7; i++) {
    const gy = (48 + i * 14) * s;
    ctx.beginPath();
    ctx.moveTo((20 + i * 1.6) * s, gy);
    ctx.lineTo((58 + i * 1.2) * s, gy);
    ctx.stroke();
  }

  const stockGrad = makeGradient(36, -18, 200, 34, [
    [0, '#1c1c1c'],
    [0.28, '#505050'],
    [0.75, '#262626'],
    [1, '#0b0b0b']
  ]);
  fillPoly([
    [40, -14],
    [144, -8],
    [178, 6],
    [178, 28],
    [144, 40],
    [42, 26]
  ], stockGrad);
  fillPoly([
    [42, -14],
    [134, -9],
    [154, 2],
    [120, 8],
    [44, 4]
  ], makeGradient(42, -14, 154, 8, [
    [0, '#707070'],
    [0.45, '#8f8f8f'],
    [1, '#3b3b3b']
  ]), 0.82);
  ctx.fillStyle = '#191919';
  ctx.fillRect(170 * s, 2 * s, 12 * s, 28 * s);
  ctx.fillStyle = '#373737';
  ctx.fillRect(38 * s, -8 * s, 102 * s, 11 * s);

  ctx.globalAlpha = 0.06;
  ctx.fillStyle = makeGradient(-240, -48, 180, 90, [
    [0, '#fff'],
    [0.35, '#fff'],
    [0.7, 'rgba(255,255,255,0.1)'],
    [1, 'rgba(255,255,255,0)']
  ]);
  ctx.beginPath();
  ctx.moveTo(-240 * s, -28 * s);
  ctx.lineTo(150 * s, -10 * s);
  ctx.lineTo(118 * s, 24 * s);
  ctx.lineTo(-236 * s, 12 * s);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  if (muzzleFlash > 0.3) {
    const fa = (muzzleFlash - 0.3) / 0.7;
    const fx = -268 * s;
    const fy = -4 * s;
    const fs = Math.max(1, 56 * s * fa);
    ctx.globalAlpha = fa;

    const fGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, fs);
    fGrad.addColorStop(0, 'rgba(255,255,220,0.96)');
    fGrad.addColorStop(0.16, 'rgba(255,220,80,0.82)');
    fGrad.addColorStop(0.42, 'rgba(255,140,30,0.42)');
    fGrad.addColorStop(0.7, 'rgba(255,80,10,0.15)');
    fGrad.addColorStop(1, 'rgba(255,40,0,0)');
    ctx.fillStyle = fGrad;
    ctx.beginPath();
    ctx.arc(fx, fy, fs, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(255,230,120,${fa * 0.55})`;
    ctx.lineWidth = 2 * s;
    for (let i = 0; i < 6; i++) {
      const a = Math.PI + (i - 2.5) * 0.28 + (Math.random() - 0.5) * 0.16;
      const sl = fs * (0.55 + Math.random() * 0.6);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + Math.cos(a) * sl, fy + Math.sin(a) * sl);
      ctx.stroke();
    }

    ctx.globalAlpha = fa * 0.12;
    ctx.fillStyle = '#999';
    for (let i = 0; i < 3; i++) {
      const sx = fx - 10 * s * i - Math.random() * 8 * s;
      ctx.beginPath();
      ctx.arc(sx, fy + (Math.random() - 0.5) * 10 * s, (4 + i * 3) * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
// Shoot
function shoot() {
  if (!gameRunning) return;

  // Set visual state FIRST, before anything that could fail
  muzzleFlash = 1;
  gunRecoil = 1;
  totalShots++;

  initAudio();
  playSound('shoot');

  // Sort targets by depth (furthest first for click priority with overlaps)
  const sorted = [...targets].sort((a, b) => b.z - a.z);

  let hit = false;
  for (const target of sorted) {
    if (target.hitTest(mouseX, mouseY)) {
      // Hit!
      hit = true;
      const pos = target.getScreenPos();

      combo++;
      if (combo > maxCombo) maxCombo = combo;

      let points = target.points;
      const multiplier = Math.min(combo, 5);
      if (combo >= 3) {
        points = Math.round(points * (1 + (multiplier - 1) * 0.25));
        playSound('combo');
      }

      if (points > longestShot) longestShot = points;

      score += points;
      totalHits++;

      target.alive = false;
      target.hitAnim = 1;

      playSound('hit');

      // Spawn enhanced particles
      for (let i = 0; i < 12; i++) {
        const sparkColors = ['#e94560', '#ffcc00', '#ff6b6b', '#fff', '#ff8800'];
        particles.push(new Particle(pos.x, pos.y, sparkColors[i % sparkColors.length], 'spark'));
      }
      for (let i = 0; i < 4; i++) {
        particles.push(new Particle(pos.x, pos.y, '#555', 'smoke'));
      }
      for (let i = 0; i < 5; i++) {
        particles.push(new Particle(pos.x, pos.y, '#ffaa30', 'ember'));
      }

      // Floating score
      showFloatingScore(pos.x, pos.y, points, combo >= 3 ? multiplier : 0);

      // Update combo display
      if (combo >= 3) {
        const comboEl = document.getElementById('comboDisplay');
        comboEl.textContent = `COMBO x${combo}!`;
        comboEl.style.opacity = 1;
        setTimeout(() => comboEl.style.opacity = 0, 800);
      }

      break;
    }
  }

  if (!hit) {
    combo = 0;
    playSound('miss');
    // Show miss indicator
    const miss = document.createElement('div');
    miss.className = 'miss-indicator';
    miss.textContent = 'MISS';
    miss.style.left = mouseX + 'px';
    miss.style.top = mouseY + 'px';
    document.getElementById('floatingScores').appendChild(miss);
    setTimeout(() => miss.remove(), 700);
  }

  updateHUD();
}

function showFloatingScore(x, y, pts, comboMult) {
  const el = document.createElement('div');
  el.className = 'float-score';
  el.textContent = comboMult > 0 ? `+${pts} (x${comboMult})` : `+${pts}`;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  if (pts >= 50) {
    el.style.fontSize = '32px';
    el.style.color = '#ff6b6b';
  }
  document.getElementById('floatingScores').appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function updateHUD() {
  document.getElementById('scoreDisplay').textContent = score;
  document.getElementById('timeDisplay').textContent = timeLeft;
  document.getElementById('hitsDisplay').textContent = totalHits;
  document.getElementById('shotsDisplay').textContent = totalShots;
}

// Game loop
function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  ctx.clearRect(0, 0, W, H);
  drawBackground();

  if (gameRunning) {
    try {
      // Update targets
      targets.forEach(t => t.update(dt));
      targets.sort((a, b) => b.z - a.z);
      targets.forEach(t => t.draw());

      // Update particles
      particles = particles.filter(p => p.life > 0);
      particles.forEach(p => { p.update(dt); p.draw(); });
    } catch(e) { console.error('render error:', e); }

    // Muzzle flash decay
    if (muzzleFlash > 0) muzzleFlash = Math.max(0, muzzleFlash - dt * 12);

    // Ensure clean canvas state before gun/crosshair
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);

<<<<<<< ours
<<<<<<< ours
    try { drawGun(dt); } catch(e) { console.error('drawGun error:', e); }
=======
    try { drawGunFacingRange(dt); } catch(e) { console.error('drawGun error:', e); }
>>>>>>> theirs
=======
    try { drawGunFacingRange(dt); } catch(e) { console.error('drawGun error:', e); }
>>>>>>> theirs
  }

  // Ensure clean canvas state for crosshair
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.setLineDash([]);

  try { drawCrosshair(); } catch(e) { console.error('drawCrosshair error:', e); }

  // === POST-PROCESSING EFFECTS ===
  try { drawPostEffects(); } catch(e) { console.error('postfx error:', e); }

  requestAnimationFrame(gameLoop);
}

// Post-processing: vignette, scanlines, screen flash
let screenFlash = 0;
function drawPostEffects() {
  // Vignette
  const vigGrad = ctx.createRadialGradient(W / 2, H / 2, W * 0.25, W / 2, H / 2, W * 0.85);
  vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
  vigGrad.addColorStop(0.7, 'rgba(0,0,0,0)');
  vigGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vigGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle scanlines
  ctx.globalAlpha = 0.03;
  ctx.fillStyle = '#000';
  for (let y = 0; y < H; y += 4) {
    ctx.fillRect(0, y, W, 1);
  }
  ctx.globalAlpha = 1;

  // Screen flash on shot
  if (muzzleFlash > 0.5) {
    ctx.globalAlpha = (muzzleFlash - 0.5) * 0.08;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  // Low time warning pulse
  if (gameRunning && timeLeft <= 5 && timeLeft > 0) {
    const pulse = Math.sin(Date.now() * 0.008) * 0.5 + 0.5;
    ctx.globalAlpha = pulse * 0.06;
    ctx.fillStyle = '#e94560';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
}

// Menu functions
function setTime(t, btn) {
  gameDuration = t;
  btn.parentElement.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function setSpeed(s, btn) {
  speedSetting = s;
  btn.parentElement.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function setAimAssist(val, btn) {
  aimAssist = val;
  btn.parentElement.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function goHome() {
  window.location.href = './';
}

function showMenu() {
  document.getElementById('menu').classList.remove('hidden');
  document.getElementById('gameOver').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('restartBtn').classList.add('hidden');
  document.getElementById('endRunBtn').classList.add('hidden');
  gameRunning = false;
  document.body.style.cursor = 'default';
}

function startGame() {
  initAudio();

  document.getElementById('menu').classList.add('hidden');
  document.getElementById('gameOver').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('restartBtn').classList.remove('hidden');
  document.getElementById('endRunBtn').classList.remove('hidden');
  document.body.style.cursor = 'none';

  score = 0;
  timeLeft = gameDuration;
  totalShots = 0;
  totalHits = 0;
  combo = 0;
  maxCombo = 0;
  longestShot = 0;
  targets = [];
  particles = [];
  muzzleFlash = 0;

  // Create targets
  const numTargets = 8;
  for (let i = 0; i < numTargets; i++) {
    targets.push(new Target());
  }

  gameRunning = true;
  updateHUD();

  // Clear old timer
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    if (!gameRunning) return;
    timeLeft--;

    if (timeLeft <= 5 && timeLeft > 0) playSound('countdown');

    updateHUD();

    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

function endGame() {
  gameRunning = false;
  if (timerInterval) clearInterval(timerInterval);

  playSound('gameOver');

  document.body.style.cursor = 'default';

  const accuracy = totalShots > 0 ? Math.round(totalHits / totalShots * 100) : 0;

  // Calculate rank
  let rank = '';
  const scorePerSec = score / gameDuration;
  if (scorePerSec >= 25 && accuracy >= 80) rank = '★ MASTER MARKSMAN ★';
  else if (scorePerSec >= 18 && accuracy >= 65) rank = '★ SHARPSHOOTER ★';
  else if (scorePerSec >= 12 && accuracy >= 50) rank = '★ MARKSMAN ★';
  else if (scorePerSec >= 6) rank = '★ SHOOTER ★';
  else rank = '★ RECRUIT ★';

  document.getElementById('finalScore').textContent = score;
  document.getElementById('finalAccuracy').textContent = accuracy + '%';
  document.getElementById('finalCombo').textContent = maxCombo;
  document.getElementById('finalLongest').textContent = longestShot;
  document.getElementById('goRank').textContent = rank;

  document.getElementById('gameOver').classList.remove('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('restartBtn').classList.add('hidden');
  document.getElementById('endRunBtn').classList.add('hidden');
}

// Events
document.addEventListener('mousemove', e => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

document.addEventListener('mousedown', e => {
  if (e.button !== 0) return; // left click only
  if (!gameRunning) return;
  // Don't shoot if clicking on restart button
  if (e.target.id === 'restartBtn' || e.target.id === 'endRunBtn') return;
  e.preventDefault();
  shoot();
});

// Prevent double-click text selection
document.addEventListener('dblclick', e => {
  if (gameRunning) e.preventDefault();
});

// Prevent drag
document.addEventListener('dragstart', e => {
  if (gameRunning) e.preventDefault();
});

window.addEventListener('keydown', e => {
  if (e.code === 'Space' && gameRunning) {
    e.preventDefault();
    shoot();
  }
});

// Prevent context menu
document.addEventListener('contextmenu', e => {
  if (gameRunning) e.preventDefault();
});

// Start rendering
lastTime = performance.now();
requestAnimationFrame(gameLoop);
<<<<<<< ours
<<<<<<< ours

=======

>>>>>>> theirs
=======
<<<<<<< ours

=======

>>>>>>> theirs
>>>>>>> theirs
