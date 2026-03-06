const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const barsContainer = document.getElementById('bars');
const eventText = document.getElementById('event-text');
const hintText = document.getElementById('hint');
const dayEl = document.getElementById('day');
const phaseEl = document.getElementById('phase');
const progressEl = document.getElementById('progress');
const moneyEl = document.getElementById('money');
const logList = document.getElementById('log-list');
const endingDialog = document.getElementById('ending-dialog');
const endingTitle = document.getElementById('ending-title');
const endingText = document.getElementById('ending-text');
const restartBtn = document.getElementById('restart-btn');

const TILE = 48;
const COLS = 20;
const ROWS = 11;
const PHASES = ['早晨', '下午', '深夜'];

const statsMeta = [
  { key: 'energy', label: '精力', color: '#7ee787' },
  { key: 'health', label: '健康', color: '#79c0ff' },
  { key: 'morale', label: '心态', color: '#d2a8ff' },
  { key: 'burnout', label: '倦怠', color: '#ff7b72', inverse: true },
  { key: 'hunger', label: '饥饿', color: '#f2cc60', inverse: true },
];

const facilities = [
  {
    id: 'desk', name: 'Desk', x: 4, y: 3, color: '#5f8cff',
    action: () => ({ progress: 8, energy: -10, morale: -4, hunger: 6, money: 120, burnout: 6, health: -2, log: '你在工位专注产出，需求又悄悄增加了。' }),
  },
  {
    id: 'pantry', name: 'Pantry', x: 15, y: 2, color: '#f2cc60',
    action: () => ({ hunger: -22, energy: 8, morale: 4, money: -35, burnout: -4, log: '你吃了口热饭，觉得自己重新像个人。' }),
  },
  {
    id: 'lounge', name: 'Lounge', x: 6, y: 8, color: '#7ee787',
    action: () => ({ energy: 14, morale: 12, burnout: -10, progress: -1, hunger: 5, log: '你在休息区放空，思路反而更清晰。' }),
  },
  {
    id: 'gym', name: 'Gym', x: 14, y: 8, color: '#79c0ff',
    action: () => ({ health: 12, morale: 5, energy: -6, burnout: -8, hunger: 8, money: -20, log: '运动 20 分钟，你把焦虑从身体里排出去一点。' }),
  },
  {
    id: 'boss', name: 'Leader Office', x: 10, y: 5, color: '#ff7b72',
    action: () => ({ progress: 18, money: 260, energy: -22, morale: -12, burnout: 16, health: -8, hunger: 10, log: 'Leader 说“再冲一下”，你交付了，但笑容消失了。' }),
  },
];

const keys = new Set();
let state;
let paused = false;
let gameOver = false;
let lastTs = 0;
let accum = 0;

function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

function init() {
  state = {
    day: 1,
    phase: 0,
    progress: 0,
    money: 1000,
    energy: 72,
    health: 75,
    morale: 68,
    burnout: 20,
    hunger: 20,
    player: { x: 2.5, y: 2.5, speed: 4.2 },
    logs: ['你入职了一家“奋斗者优先”公司，先活下来再说。'],
    worldTick: 0,
  };
  gameOver = false;
  paused = false;
  renderHud();
  draw();
}

function randomEvent() {
  const events = [
    { text: '需求评审临时改口，返工 +1。', effect: { morale: -5, burnout: 5 } },
    { text: '同事分享自动化脚本，重复劳动下降。', effect: { morale: 6, burnout: -6, progress: 4 } },
    { text: '半夜报警，睡眠被切碎。', effect: { energy: -10, health: -6, burnout: 8 } },
    { text: '你明确拒绝无意义加班，白天效率反而更高。', effect: { morale: 8, burnout: -7, progress: 3 } },
  ];
  return events[Math.floor(Math.random() * events.length)];
}

function applyEffect(effect) {
  ['progress', 'money', 'energy', 'health', 'morale', 'burnout', 'hunger'].forEach((k) => {
    if (effect[k]) state[k] += effect[k];
  });
  state.progress = clamp(state.progress);
  state.energy = clamp(state.energy);
  state.health = clamp(state.health);
  state.morale = clamp(state.morale);
  state.burnout = clamp(state.burnout);
  state.hunger = clamp(state.hunger);
}

function doInteraction() {
  if (gameOver) return;
  const nearest = facilities.find((f) => Math.hypot(state.player.x - (f.x + 0.5), state.player.y - (f.y + 0.5)) < 1.35);
  if (!nearest) {
    eventText.textContent = '附近没有可交互设施。靠近彩色建筑后按 E。';
    return;
  }

  const effect = nearest.action();
  applyEffect(effect);
  pushLog(`[Day ${state.day} ${PHASES[state.phase]}] ${effect.log}`);

  const ev = randomEvent();
  applyEffect(ev.effect);
  eventText.textContent = `${nearest.name} -> ${ev.text}`;
  advancePhase();
  checkEnding();
  renderHud();
}

function pushLog(text) {
  state.logs.unshift(text);
  state.logs = state.logs.slice(0, 12);
}

function advancePhase() {
  state.phase += 1;
  if (state.phase > 2) {
    state.phase = 0;
    state.day += 1;
    state.hunger = clamp(state.hunger + 8);
    state.burnout = clamp(state.burnout + 4);
  }
}

function worldDecay(dt) {
  accum += dt;
  if (accum < 1) return;
  accum = 0;
  state.worldTick += 1;
  state.hunger = clamp(state.hunger + 1);
  state.energy = clamp(state.energy - 0.8);
  state.morale = clamp(state.morale - (state.burnout > 70 ? 1.2 : 0.4));
  if (state.hunger > 75) state.health = clamp(state.health - 1.1);
  if (state.hunger > 85) state.energy = clamp(state.energy - 1.3);
  if (state.worldTick % 18 === 0) {
    state.burnout = clamp(state.burnout + 1.2);
  }
  checkEnding();
  renderHud();
}

function checkEnding() {
  if (gameOver) return;
  let ending = null;
  if (state.health <= 0 || state.energy <= 0) {
    ending = ['身体透支结局', '你扛过了每个截止日期，却没扛过自己的身体。'];
  } else if (state.morale <= 0 || state.burnout >= 100) {
    ending = ['心理崩溃结局', '工作完成了，热爱却耗尽了。是时候重建边界。'];
  } else if (state.day > 16) {
    if (state.progress >= 88 && state.health >= 55 && state.burnout <= 55) {
      ending = ['平衡结局', '你用可持续节奏完成交付：高质量 ≠ 无穷加班。'];
    } else if (state.progress >= 88) {
      ending = ['燃尽式胜利', '项目上线了，但你像没电的 UPS。'];
    } else {
      ending = ['迷失结局', '你在系统里消耗太久，忘了自己要去哪里。'];
    }
  }

  if (ending) {
    gameOver = true;
    endingTitle.textContent = ending[0];
    endingText.textContent = ending[1];
    endingDialog.showModal();
  }
}

function getHint() {
  if (state.burnout > 70) return '倦怠很高：去 Lounge/Gym 先恢复，再追进度。';
  if (state.hunger > 70) return '你很饿：Pantry 的收益通常高于硬撑。';
  if (state.progress < 50 && state.day > 9) return '中后期了：Desk 与 Leader Office 要合理混用。';
  return '找“稳定节奏”：输出、吃饭、休息、社交循环才可持续。';
}

function renderHud() {
  dayEl.textContent = String(state.day);
  phaseEl.textContent = PHASES[state.phase];
  progressEl.textContent = `${Math.round(state.progress)}%`;
  moneyEl.textContent = `¥${Math.round(state.money)}`;
  hintText.textContent = `提示：${getHint()}`;

  barsContainer.innerHTML = '';
  statsMeta.forEach(({ key, label, color, inverse }) => {
    const value = Math.round(state[key]);
    const width = inverse ? 100 - value : value;
    const item = document.createElement('div');
    item.className = 'bar-item';
    item.innerHTML = `
      <div class="bar-label"><span>${label}</span><span>${value}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${width}%;background:${color}"></div></div>
    `;
    barsContainer.appendChild(item);
  });

  logList.innerHTML = '';
  state.logs.forEach((l) => {
    const li = document.createElement('li');
    li.textContent = l;
    logList.appendChild(li);
  });
}

function drawTile(x, y, color) {
  const isoX = x * TILE + (y % 2) * 2;
  const isoY = y * TILE;
  ctx.fillStyle = color;
  ctx.fillRect(isoX, isoY, TILE - 2, TILE - 2);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const checker = (x + y) % 2 === 0 ? '#142233' : '#16283d';
      drawTile(x, y, checker);
    }
  }

  facilities.forEach((f) => {
    drawTile(f.x, f.y, f.color);
    ctx.fillStyle = '#0b0f16';
    ctx.font = '12px sans-serif';
    ctx.fillText(f.name, f.x * TILE + 3, f.y * TILE + 18);
  });

  const px = state.player.x * TILE;
  const py = state.player.y * TILE;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(px, py, 13, 0, Math.PI * 2);
  ctx.fill();

  const near = facilities.find((f) => Math.hypot(state.player.x - (f.x + 0.5), state.player.y - (f.y + 0.5)) < 1.35);
  if (near && !gameOver) {
    ctx.fillStyle = '#7ee787';
    ctx.font = '16px sans-serif';
    ctx.fillText(`按 E 与 ${near.name} 交互`, 20, canvas.height - 18);
  }

  if (paused && !gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = '28px sans-serif';
    ctx.fillText('已暂停', canvas.width / 2 - 50, canvas.height / 2);
  }
}

function update(dt) {
  if (paused || gameOver) return;

  let dx = 0;
  let dy = 0;
  if (keys.has('arrowup') || keys.has('w')) dy -= 1;
  if (keys.has('arrowdown') || keys.has('s')) dy += 1;
  if (keys.has('arrowleft') || keys.has('a')) dx -= 1;
  if (keys.has('arrowright') || keys.has('d')) dx += 1;

  const length = Math.hypot(dx, dy) || 1;
  const speed = state.player.speed * dt;
  state.player.x = Math.max(0.4, Math.min(COLS - 0.5, state.player.x + (dx / length) * speed));
  state.player.y = Math.max(0.4, Math.min(ROWS - 0.5, state.player.y + (dy / length) * speed));

  worldDecay(dt);
}

function loop(ts) {
  const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0);
  lastTs = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  keys.add(key);
  if (key === 'e') doInteraction();
  if (key === ' ' || key === 'spacebar') paused = !paused;
});

document.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

restartBtn.addEventListener('click', () => {
  endingDialog.close();
  init();
});

init();
requestAnimationFrame(loop);
