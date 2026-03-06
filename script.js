const barsContainer = document.getElementById('bars');
const actionsContainer = document.getElementById('actions');
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

const STAT_META = [
  { key: 'energy', label: '精力', color: '#7ee787' },
  { key: 'health', label: '健康', color: '#79c0ff' },
  { key: 'morale', label: '心态', color: '#d2a8ff' },
  { key: 'burnout', label: '倦怠', color: '#ff7b72', inverse: true },
  { key: 'hunger', label: '饥饿', color: '#f2cc60', inverse: true },
];

const ACTIONS = [
  {
    name: '认真开发',
    desc: '稳步推进项目。',
    effect: (s) => ({
      progress: 12,
      energy: -16,
      hunger: 10,
      morale: -5,
      money: 200,
      burnout: 8,
      log: '你完成了两个需求，PM 说“非常好，下周再冲一把”。',
    }),
  },
  {
    name: '被迫加班',
    desc: '短期冲刺，长期爆炸。',
    effect: (s) => ({
      progress: 22,
      energy: -28,
      health: -12,
      hunger: 16,
      morale: -10,
      money: 380,
      burnout: 18,
      log: '你在 23:40 提交了代码，群里回复：收到。',
    }),
  },
  {
    name: '正常吃饭',
    desc: '人是铁，饭是钢。',
    effect: () => ({
      hunger: -28,
      energy: 12,
      health: 6,
      morale: 5,
      money: -45,
      burnout: -6,
      log: '你认真吃了一顿饭，意识到自己不是 CI/CD 的一部分。',
    }),
  },
  {
    name: '早睡休息',
    desc: '给身体和大脑回血。',
    effect: () => ({
      energy: 24,
      health: 10,
      morale: 10,
      burnout: -12,
      hunger: 8,
      progress: -2,
      log: '你按时休息，明天写代码像开了自动补全。',
    }),
  },
  {
    name: '和朋友见面',
    desc: '重新感受生活。',
    effect: () => ({
      morale: 18,
      burnout: -14,
      energy: -8,
      hunger: 6,
      money: -80,
      log: '朋友提醒你：工作是生活的一部分，不是全部。',
    }),
  },
  {
    name: '摸鱼学习',
    desc: '悄悄提升自己。',
    effect: () => ({
      progress: 8,
      morale: 8,
      energy: -10,
      burnout: -4,
      money: 120,
      log: '你学了新技术，开始思考怎样更高效而不是更长工时。',
    }),
  },
];

const PHASES = ['上午', '下午', '夜晚'];

let state;

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function init() {
  state = {
    day: 1,
    phaseIndex: 0,
    progress: 0,
    money: 1000,
    energy: 72,
    health: 75,
    morale: 70,
    burnout: 18,
    hunger: 15,
    logs: ['你租了一个离公司 40 分钟地铁的单间，准备开始这段职场生存挑战。'],
    gameOver: false,
  };

  drawActions();
  render();
}

function drawActions() {
  actionsContainer.innerHTML = '';
  ACTIONS.forEach((action, index) => {
    const btn = document.createElement('button');
    btn.innerHTML = `<strong>${action.name}</strong><br/><small>${action.desc}</small>`;
    btn.addEventListener('click', () => takeAction(index));
    actionsContainer.appendChild(btn);
  });
}

function randomOfficeEvent() {
  const events = [
    {
      text: 'Leader 发来一句“简单优化一下就行”，你看到需求文档新增了 3 页。',
      effect: { morale: -6, burnout: 7 },
    },
    {
      text: '你推动了自动化脚本，团队节省了重复劳动时间。',
      effect: { morale: 8, burnout: -6, progress: 4 },
    },
    {
      text: '同事帮你顶了一次线上问题，你感受到互相支持。',
      effect: { morale: 6, burnout: -4 },
    },
    {
      text: '半夜报警把你吵醒，第二天像丧尸一样开会。',
      effect: { energy: -10, health: -6, burnout: 8 },
    },
    {
      text: '你拒绝了无意义周末加班，反而更高效完成任务。',
      effect: { morale: 10, burnout: -8, progress: 5 },
    },
  ];
  return events[Math.floor(Math.random() * events.length)];
}

function applyEffect(effect) {
  const keys = ['progress', 'money', 'energy', 'health', 'morale', 'burnout', 'hunger'];
  keys.forEach((key) => {
    if (effect[key]) {
      state[key] += effect[key];
    }
  });

  state.progress = clamp(state.progress, 0, 100);
  state.energy = clamp(state.energy);
  state.health = clamp(state.health);
  state.morale = clamp(state.morale);
  state.burnout = clamp(state.burnout);
  state.hunger = clamp(state.hunger);
}

function advanceTime() {
  state.phaseIndex += 1;
  if (state.phaseIndex > 2) {
    state.phaseIndex = 0;
    state.day += 1;
    state.hunger = clamp(state.hunger + 6);
    state.burnout = clamp(state.burnout + 4);
  }
}

function evaluateStatus() {
  if (state.health <= 0 || state.energy <= 0) {
    return {
      title: '身体发出红色警报',
      text: '你终于撑不住了。你意识到：长期透支无法换来真正的成长。',
    };
  }

  if (state.burnout >= 100 || state.morale <= 0) {
    return {
      title: '心理防线崩溃',
      text: '你完成了很多任务，却丢失了热情。该重新定义“成功”了。',
    };
  }

  if (state.day > 14) {
    if (state.progress >= 85 && state.health >= 55 && state.burnout <= 55) {
      return {
        title: '平衡结局：可持续的优秀',
        text: '你交付了项目，也守住了生活边界。你证明了高质量不等于无限加班。',
      };
    }
    if (state.progress >= 85) {
      return {
        title: '单一胜利结局',
        text: '项目上线了，但你像被榨干的电池。真正的终点不是 KPI，而是长期主义。',
      };
    }
    return {
      title: '迷失结局',
      text: '你既没活成自己，也没完成目标。也许是时候改变系统而非苛责自己。',
    };
  }

  return null;
}

function takeAction(actionIndex) {
  if (state.gameOver) {
    return;
  }

  const action = ACTIONS[actionIndex];
  const effect = action.effect(state);
  applyEffect(effect);
  state.logs.unshift(`[Day ${state.day} ${PHASES[state.phaseIndex]}] ${effect.log}`);

  const event = randomOfficeEvent();
  applyEffect(event.effect);
  eventText.textContent = event.text;

  advanceTime();
  const ending = evaluateStatus();

  if (ending) {
    state.gameOver = true;
    endingTitle.textContent = ending.title;
    endingText.textContent = ending.text;
    endingDialog.showModal();
  }

  render();
}

function getHint() {
  if (state.burnout > 70) {
    return '倦怠偏高：短期高产可能在偷走你的长期能力。';
  }
  if (state.hunger > 70) {
    return '你已经很饿了：按时吃饭是最便宜的续航策略。';
  }
  if (state.morale < 35) {
    return '心态偏低：试着社交或休息，别把痛苦合理化。';
  }
  if (state.progress < 45 && state.day > 8) {
    return '进度偏慢：用专注开发或学习提升效率，而不是盲目拉时长。';
  }
  return '你在和系统博弈：把自己当“人”，而不是可替换资源。';
}

function renderBars() {
  barsContainer.innerHTML = '';
  STAT_META.forEach(({ key, label, color, inverse }) => {
    const value = state[key];
    const percent = inverse ? 100 - value : value;

    const wrapper = document.createElement('div');
    wrapper.className = 'bar-item';
    wrapper.innerHTML = `
      <div class="bar-label"><span>${label}</span><span>${value}</span></div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${percent}%;background:${color};"></div>
      </div>
    `;
    barsContainer.appendChild(wrapper);
  });
}

function renderLogs() {
  logList.innerHTML = '';
  state.logs.slice(0, 8).forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    logList.appendChild(li);
  });
}

function render() {
  dayEl.textContent = String(state.day);
  phaseEl.textContent = PHASES[state.phaseIndex];
  progressEl.textContent = `${state.progress}%`;
  moneyEl.textContent = `¥${state.money}`;
  hintText.textContent = `提示：${getHint()}`;

  renderBars();
  renderLogs();

  Array.from(actionsContainer.querySelectorAll('button')).forEach((btn) => {
    btn.disabled = state.gameOver;
  });
}

restartBtn.addEventListener('click', () => {
  endingDialog.close();
  init();
});

init();
