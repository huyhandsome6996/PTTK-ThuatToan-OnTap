/* ==========================================================================
   KTMT-BTMT OnTap - Common JavaScript v2.0
   Enhanced with: dark mode, progress tracking, search, smooth animations
   ========================================================================== */

// ----- Theme management -----
const Theme = {
  init() {
    const saved = localStorage.getItem('ktmt-theme') || 'light';
    this.set(saved);
    // Add toggle button if not exists
    document.addEventListener('DOMContentLoaded', () => {
      if (!document.querySelector('.theme-toggle')) {
        const btn = document.createElement('button');
        btn.className = 'theme-toggle';
        btn.setAttribute('aria-label', 'Toggle dark mode');
        btn.innerHTML = '🌙';
        btn.onclick = () => this.toggle();
        document.body.appendChild(btn);
        this.updateIcon();
      }
    });
  },
  set(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ktmt-theme', theme);
    this.updateIcon();
  },
  toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    this.set(current === 'dark' ? 'light' : 'dark');
  },
  updateIcon() {
    const btn = document.querySelector('.theme-toggle');
    if (btn) {
      const theme = document.documentElement.getAttribute('data-theme');
      btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
    }
  }
};
Theme.init();

// ----- Progress tracking -----
const Progress = {
  KEY: 'ktmt-progress',
  get() {
    try { return JSON.parse(localStorage.getItem(this.KEY) || '{}'); }
    catch { return {}; }
  },
  markComplete(lessonId) {
    const p = this.get();
    p[lessonId] = { completed: true, time: Date.now() };
    localStorage.setItem(this.KEY, JSON.stringify(p));
    this.updateUI();
  },
  isComplete(lessonId) {
    return !!this.get()[lessonId];
  },
  count() {
    return Object.keys(this.get()).length;
  },
  updateUI() {
    // Update lesson cards on index page
    document.querySelectorAll('[data-lesson-id]').forEach(card => {
      const id = card.getAttribute('data-lesson-id');
      if (this.isComplete(id)) {
        card.classList.add('completed');
      }
    });
    // Update progress display
    const total = 14;
    const done = this.count();
    const pct = Math.round((done / total) * 100);
    const fillEl = document.querySelector('[data-progress-fill]');
    if (fillEl) fillEl.style.width = pct + '%';
    const textEl = document.querySelector('[data-progress-text]');
    if (textEl) textEl.textContent = `${done} / ${total} bài đã hoàn thành (${pct}%)`;
  },
  reset() {
    localStorage.removeItem(this.KEY);
    this.updateUI();
  }
};

// ----- Bit manipulation helpers -----
const Bit = {
  toBin(num, width = 8) {
    if (num < 0) return (num >>> 0).toString(2).padStart(width, '1').slice(-width);
    return num.toString(2).padStart(width, '0');
  },
  toHex(num, width = 2) {
    return num.toString(16).toUpperCase().padStart(width, '0');
  },
  binToDec(binStr) { return parseInt(binStr, 2); },
  hexToDec(hexStr) { return parseInt(hexStr, 16); },

  xor(a, b) {
    let r = '';
    for (let i = 0; i < a.length; i++) r += (a[i] === b[i]) ? '0' : '1';
    return r;
  },

  invert(binStr) {
    return binStr.split('').map(b => b === '0' ? '1' : '0').join('');
  },

  twosComplement(binStr) {
    const inv = this.invert(binStr);
    let arr = inv.split('').reverse().map(Number);
    let carry = 1;
    for (let i = 0; i < arr.length && carry; i++) {
      const s = arr[i] + carry;
      arr[i] = s % 2;
      carry = Math.floor(s / 2);
    }
    return arr.reverse().join('');
  },

  renderBits(binStr, options = {}) {
    const { highlight = [], error = [], labels = false, clickable = false, onClick = null } = options;
    const wrapper = document.createElement('div');
    wrapper.className = 'bit-row';
    const bits = binStr.split('');
    bits.forEach((b, i) => {
      const el = document.createElement('div');
      el.className = 'bit ' + (b === '1' ? 'one' : 'zero');
      if (highlight.includes(i)) el.classList.add('highlight');
      if (error.includes(i)) el.classList.add('error');
      el.textContent = b;
      el.title = `Bit ${bits.length - 1 - i} (vị trí ${i})`;
      if (clickable && onClick) {
        el.style.cursor = 'pointer';
        el.onclick = () => onClick(i, el);
      }
      wrapper.appendChild(el);
    });
    if (labels) {
      const lbl = document.createElement('div');
      lbl.style.cssText = 'display:flex;gap:6px;justify-content:center;';
      bits.forEach((_, i) => {
        const l = document.createElement('div');
        l.className = 'bit-label';
        l.style.width = '42px';
        l.textContent = bits.length - 1 - i;
        lbl.appendChild(l);
      });
      wrapper.appendChild(lbl);
    }
    return wrapper;
  }
};

// ----- Number system conversion -----
const NumSys = {
  decToBinSteps(num) {
    const steps = [];
    let n = num;
    while (n > 0) {
      const q = Math.floor(n / 2), r = n % 2;
      steps.push({ dividend: n, quotient: q, remainder: r });
      n = q;
    }
    if (!steps.length) steps.push({ dividend: 0, quotient: 0, remainder: 0 });
    return steps;
  },

  decToHexSteps(num) {
    const steps = [];
    let n = num;
    const hex = '0123456789ABCDEF';
    while (n > 0) {
      const q = Math.floor(n / 16), r = n % 16;
      steps.push({ dividend: n, quotient: q, remainder: r, hexDigit: hex[r] });
      n = q;
    }
    if (!steps.length) steps.push({ dividend: 0, quotient: 0, remainder: 0, hexDigit: '0' });
    return steps;
  },

  decFracToBin(frac, maxBits = 20) {
    const steps = [];
    let f = frac;
    let result = '';
    for (let i = 0; i < maxBits; i++) {
      const p = f * 2;
      const ip = Math.floor(p);
      steps.push({ input: f, product: p, intPart: ip, remainder: p - ip });
      result += ip;
      f = p - ip;
      if (f === 0) break;
    }
    return { steps, result };
  }
};

// ----- Quiz -----
class Quiz {
  constructor(containerId, questions) {
    this.container = document.getElementById(containerId);
    this.questions = questions;
    this.render();
  }

  render() {
    this.container.innerHTML = '';
    this.questions.forEach((q, qi) => {
      const block = document.createElement('div');
      block.className = 'quiz';
      block.innerHTML = `<div class="quiz-question">Câu ${qi + 1}: ${q.question}</div>`;
      const opts = document.createElement('div');
      opts.className = 'quiz-options';
      q.options.forEach((opt, oi) => {
        const el = document.createElement('div');
        el.className = 'quiz-option';
        el.innerHTML = `<span class="quiz-letter">${String.fromCharCode(65 + oi)}</span> <span>${opt}</span>`;
        el.onclick = () => this.select(qi, oi, el);
        opts.appendChild(el);
      });
      block.appendChild(opts);
      const fb = document.createElement('div');
      fb.className = 'quiz-feedback';
      fb.id = `qfb-${qi}`;
      block.appendChild(fb);
      this.container.appendChild(block);
    });
  }

  select(qi, oi, el) {
    const siblings = el.parentElement.querySelectorAll('.quiz-option');
    siblings.forEach(s => s.classList.remove('selected', 'correct', 'wrong'));
    el.classList.add('selected');
    const q = this.questions[qi];
    const fb = document.getElementById(`qfb-${qi}`);
    fb.className = 'quiz-feedback show';
    if (oi === q.correct) {
      el.classList.add('correct');
      fb.classList.add('correct');
      fb.innerHTML = `✓ Chính xác! ${q.explanation || ''}`;
    } else {
      el.classList.add('wrong');
      fb.classList.add('wrong');
      fb.innerHTML = `✗ Chưa đúng. ${q.explanation || 'Hãy xem lại lý thuyết.'}`;
    }
  }
}

// ----- Step-by-step reveal -----
class StepReveal {
  constructor(containerId, stepsData) {
    this.container = document.getElementById(containerId);
    this.steps = stepsData;
    this.current = 0;
    this.render();
    window[this.container.id] = this;
  }

  render() {
    this.container.innerHTML = '';
    const list = document.createElement('ol');
    list.className = 'steps';
    this.steps.forEach((s, i) => {
      const li = document.createElement('li');
      li.id = `${this.container.id}-s${i}`;
      li.classList.add('hidden');
      li.innerHTML = `<span class="step-title">${s.title}</span>${s.content}`;
      list.appendChild(li);
    });
    this.container.appendChild(list);

    const ctrl = document.createElement('div');
    ctrl.className = 'visualizer-controls';
    ctrl.innerHTML = `
      <button class="btn btn-secondary" onclick="window.${this.container.id}.prev()">← Trước</button>
      <button class="btn btn-success" onclick="window.${this.container.id}.next()">Sau →</button>
      <button class="btn btn-ghost" onclick="window.${this.container.id}.showAll()">Hiện tất cả</button>
      <button class="btn btn-secondary" onclick="window.${this.container.id}.reset()">↺ Làm lại</button>
    `;
    this.container.appendChild(ctrl);

    const prog = document.createElement('div');
    prog.className = 'progress-bar';
    prog.innerHTML = `<div class="progress-bar-fill" id="${this.container.id}-p" style="width:0%"></div>`;
    this.container.appendChild(prog);

    this.update();
  }

  next() { if (this.current < this.steps.length) { this.current++; this.update(); this.scrollTo(); } }
  prev() { if (this.current > 0) { this.current--; this.update(); this.scrollTo(); } }
  showAll() { this.current = this.steps.length; this.update(); }
  reset() { this.current = 0; this.update(); }

  scrollTo() {
    const el = document.getElementById(`${this.container.id}-s${Math.max(0, this.current - 1)}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  update() {
    this.steps.forEach((_, i) => {
      const el = document.getElementById(`${this.container.id}-s${i}`);
      if (el) el.classList.toggle('hidden', i >= this.current);
    });
    const p = document.getElementById(`${this.container.id}-p`);
    if (p) p.style.width = `${(this.current / this.steps.length) * 100}%`;
  }
}

// ----- Tabs -----
function setupTabs(containerId) {
  const c = document.getElementById(containerId);
  if (!c) return;
  const tabs = c.querySelectorAll('.tab');
  const contents = c.querySelectorAll('.tab-content');
  tabs.forEach((t, i) => {
    t.onclick = () => {
      tabs.forEach(x => x.classList.remove('active'));
      contents.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      if (contents[i]) contents[i].classList.add('active');
    };
  });
}

// ----- Search -----
function setupSearch(inputId, gridId) {
  const input = document.getElementById(inputId);
  const grid = document.getElementById(gridId);
  if (!input || !grid) return;
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    grid.querySelectorAll('.lesson-card').forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = (!q || text.includes(q)) ? '' : 'none';
    });
  });
}

// ----- Lesson completion -----
function markLessonComplete(lessonId) {
  Progress.markComplete(lessonId);
  // Show toast
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; top: 80px; right: 20px;
    background: var(--gradient-success);
    color: white; padding: 16px 24px;
    border-radius: 10px; box-shadow: var(--shadow-lg);
    z-index: 9999; font-weight: 600;
    animation: slideInRight 0.3s ease-out;
  `;
  toast.innerHTML = '🎉 Hoàn thành bài học!';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ----- KaTeX -----
function renderMath() {
  if (typeof renderMathInElement !== 'undefined') {
    renderMathInElement(document.body, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false }
      ],
      throwOnError: false
    });
  }
}

// ----- Init -----
document.addEventListener('DOMContentLoaded', () => {
  renderMath();
  document.querySelectorAll('[data-tabs]').forEach(c => setupTabs(c.id));
  Progress.updateUI();
  // Auto-add lesson ID detection
  const path = window.location.pathname;
  const match = path.match(/(\d{2})-/);
  if (match) {
    const lessonId = match[1];
    const completeBtn = document.createElement('button');
    completeBtn.className = 'btn btn-success';
    completeBtn.style.cssText = 'position: fixed; bottom: 24px; left: 24px; z-index: 1000;';
    completeBtn.innerHTML = Progress.isComplete(lessonId) ? '✓ Đã hoàn thành' : 'Đánh dấu hoàn thành';
    completeBtn.onclick = () => {
      Progress.markComplete(lessonId);
      completeBtn.innerHTML = '✓ Đã hoàn thành';
    };
    if (window.innerWidth > 768) {
      document.body.appendChild(completeBtn);
    }
  }
  // Setup search on index
  setupSearch('search-input', 'lesson-grid');
});

// ----- Animations on scroll -----
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.lesson-card, .callout, .visualizer').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
    observer.observe(el);
  });
});
