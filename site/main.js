const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function revealOnEnter() {
  const targets = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
  targets.forEach((el) => observer.observe(el));
  window.addEventListener('load', () => setTimeout(() => {
    targets.forEach((el) => {
      const box = el.getBoundingClientRect();
      if (box.top < innerHeight && box.bottom > 0) el.classList.add('is-in');
    });
  }, 2500));
}

function paintHeaderByChapter() {
  const chapters = [...document.querySelectorAll('.chapter[data-ground]')];
  const root = document.documentElement.style;
  const bar = document.querySelector('.bar');
  function update() {
    const probeY = bar.offsetHeight + 1;
    const probeX = innerWidth / 2;
    const current = chapters.find((chapter) => {
      const box = chapter.getBoundingClientRect();
      return box.top <= probeY && box.bottom > probeY && box.left <= probeX && box.right > probeX;
    });
    if (!current) return;
    root.setProperty('--header-ground', current.dataset.ground);
    root.setProperty('--header-ink', current.dataset.ink);
  }
  let queued = false;
  addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; update(); });
  }, { passive: true });
  addEventListener('resize', update);
  update();
}

function driftHeroPicture() {
  const picture = document.querySelector('[data-drift]');
  if (!picture || prefersReducedMotion) return;
  picture.animate([{ transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 1600, easing: 'cubic-bezier(.16,1,.3,1)' });
  let queued = false;
  addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const box = picture.parentElement.getBoundingClientRect();
      if (box.bottom < 0 || box.top > innerHeight) return;
      const progress = Math.min(Math.max(-box.top / box.height, 0), 1);
      picture.style.transform = `translateY(${progress * 12}%) scale(${1 + progress * 0.06})`;
    });
  }, { passive: true });
}

function runApprovalBoard() {
  const board = document.querySelector('[data-board]');
  if (!board) return;
  const lists = {
    suggested: board.querySelector('[data-list="suggested"]'),
    approved: board.querySelector('[data-list="approved"]'),
  };
  const emptyNote = board.querySelector('[data-empty]');
  const tally = { approved: 0, rejected: 0 };

  function bump(name, value) {
    const node = document.querySelector(`[data-count="${name}"]`);
    node.textContent = value;
    node.classList.remove('bump');
    void node.offsetWidth;
    node.classList.add('bump');
  }

  function refreshCounts() {
    const waiting = lists.suggested.children.length;
    board.querySelector('[data-col-count="suggested"]').textContent = waiting;
    board.querySelector('[data-col-count="approved"]').textContent = lists.approved.children.length;
    emptyNote.hidden = lists.approved.children.length > 0;
    bump('waiting', waiting);
  }

  function leave(draft, then) {
    draft.classList.add('is-leaving');
    setTimeout(then, prefersReducedMotion ? 0 : 260);
  }

  function approve(draft) {
    leave(draft, () => {
      draft.classList.remove('is-leaving');
      draft.classList.add('is-approved', 'is-arriving');
      lists.approved.prepend(draft);
      tally.approved += 1;
      bump('approved', tally.approved);
      refreshCounts();
    });
  }

  function reject(draft) {
    leave(draft, () => {
      draft.remove();
      tally.rejected += 1;
      bump('rejected', tally.rejected);
      refreshCounts();
    });
  }

  function writeAgain(draft, button) {
    const text = draft.querySelector('.draft-text');
    const versions = draft.dataset.alt.split('|');
    const next = versions.shift();
    draft.dataset.alt = [...versions, text.textContent].join('|');
    draft.classList.add('is-writing');
    button.disabled = true;
    button.textContent = 'Writing...';
    setTimeout(() => {
      text.textContent = next;
      draft.classList.remove('is-writing');
      button.disabled = false;
      button.textContent = 'Write again';
    }, prefersReducedMotion ? 0 : 900);
  }

  board.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-act]');
    if (!button) return;
    const draft = button.closest('.draft');
    if (button.dataset.act === 'approve') approve(draft);
    if (button.dataset.act === 'reject') reject(draft);
    if (button.dataset.act === 'redo') writeAgain(draft, button);
  });
}

function switchSetupTabs() {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  function select(tab) {
    tabs.forEach((other) => {
      const selected = other === tab;
      other.setAttribute('aria-selected', selected);
      other.tabIndex = selected ? 0 : -1;
      document.getElementById(other.getAttribute('aria-controls')).hidden = !selected;
    });
    tab.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
      select(tabs[(index + step + tabs.length) % tabs.length]);
    });
  });
}

function copyCommands() {
  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        button.textContent = 'Copied';
      } catch {
        button.textContent = 'Select it';
      }
      button.classList.add('is-done');
      setTimeout(() => {
        button.textContent = 'Copy';
        button.classList.remove('is-done');
      }, 1600);
    });
  });
}

function runNewBrandDialog() {
  const dialog = document.querySelector('[data-dialog]');
  if (!dialog) return;
  const modes = {
    website: { label: 'Website', value: 'https://sunrisebakery.example', help: 'Paste a link. Lumo reads your site and researches the web for your name, features, audience and competitors.' },
    manual: { label: 'Brand name', value: 'Sunrise Bakery', help: 'You will describe your brand yourself on the next page.' },
  };
  const input = dialog.querySelector('input');
  dialog.querySelectorAll('[data-mode]').forEach((choice) => {
    choice.addEventListener('click', () => {
      const mode = modes[choice.dataset.mode];
      dialog.querySelectorAll('[data-mode]').forEach((other) => other.setAttribute('aria-checked', other === choice));
      dialog.querySelector('[data-label]').textContent = mode.label;
      dialog.querySelector('[data-help]').textContent = mode.help;
      input.value = mode.value;
    });
  });
  dialog.addEventListener('submit', (event) => {
    event.preventDefault();
    window.location.href = dialog.action;
  });
}

function playHeroVideo() {
  const video = document.querySelector('[data-hero-video]');
  const savesData = navigator.connection && navigator.connection.saveData;
  if (!video || prefersReducedMotion || savesData) return;
  video.preload = 'auto';
  const play = () => video.play().catch(() => {});
  if (!('IntersectionObserver' in window)) {
    play();
    return;
  }
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) play();
    else video.pause();
  }).observe(video);
}

async function showStarCount() {
  const button = document.querySelector('[data-stars]');
  if (!button) return;
  try {
    const response = await fetch('https://api.github.com/repos/kotlovyim-dev/OpenLumo');
    if (!response.ok) return;
    const { stargazers_count: stars } = await response.json();
    if (stars > 0) button.insertAdjacentHTML('beforeend', `<b>${stars.toLocaleString('en')}</b>`);
  } catch {
    return;
  }
}

revealOnEnter();
paintHeaderByChapter();
driftHeroPicture();
playHeroVideo();
runApprovalBoard();
switchSetupTabs();
copyCommands();
runNewBrandDialog();
showStarCount();
