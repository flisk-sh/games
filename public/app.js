const $ = (sel) => document.querySelector(sel);
const view = $('#view');

// All catalog text goes in as text nodes, never HTML.
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (value !== null && value !== undefined && value !== false) node.setAttribute(key, value);
  }
  node.append(...children.filter(Boolean));
  return node;
}

const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
};

let games = [];
let user = null;
let category = 'All';

const savedKey = () => `saved:${user?.login || ''}`;
const isSaved = (id) => store.get(savedKey(), []).includes(id);
function toggleSaved(id) {
  const list = store.get(savedKey(), []);
  store.set(savedKey(), list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
}

function toast(text) {
  $('#toast').textContent = text;
  $('#toast').classList.add('on');
  setTimeout(() => $('#toast').classList.remove('on'), 2200);
}

const host = (url) => new URL(url).hostname;

function card(game) {
  return el('a', { class: 'card', href: `/play/${game.id}`, 'data-nav': '' },
    el('img', { class: 'thumb', src: game.thumb, alt: '', loading: 'lazy' }),
    el('div', { class: 'meta' },
      el('span', { class: 'avatar' }, game.author[0]),
      el('div', {},
        el('h3', {}, game.title),
        el('p', {}, game.author),
        el('p', {}, `${game.category} · ${host(game.url)}`))));
}

const empty = (title, text) => el('div', { class: 'empty' }, el('h2', {}, title), el('p', {}, text));

function grid(list, emptyTitle, emptyText) {
  return list.length ? el('div', { class: 'grid' }, ...list.map(card)) : empty(emptyTitle, emptyText);
}

function matches(game) {
  const q = $('#search').value.trim().toLowerCase();
  return !q || `${game.title} ${game.author} ${game.category} ${game.description}`.toLowerCase().includes(q);
}

function home() {
  const chips = ['All', 'New', ...new Set(games.map((g) => g.category))];
  let list = games.filter(matches);
  if (category === 'New') list = [...list].sort((a, b) => b.added.localeCompare(a.added));
  else if (category !== 'All') list = list.filter((g) => g.category === category);
  return [
    el('nav', { class: 'chips', 'aria-label': 'Categories' }, ...chips.map((name) =>
      el('button', { type: 'button', class: 'chip', 'aria-pressed': String(name === category), onclick: () => { category = name; render(); } }, name))),
    grid(list, 'No games found', 'Try another search or category.'),
  ];
}

// A game that allows framing plays here. One that does not opens in its own tab.
function player(game) {
  if (game.embed) {
    return el('iframe', { class: 'frame', src: game.url, title: game.title, allow: 'fullscreen; gamepad; autoplay', allowfullscreen: '', sandbox: 'allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-forms' });
  }
  return el('a', { class: 'frame poster', href: game.url, target: '_blank', rel: 'noopener' },
    el('img', { src: game.thumb, alt: '' }),
    el('span', { class: 'pill play' }, '▶ Play in a new tab'));
}

async function share(game) {
  const link = `${location.origin}/play/${game.id}`;
  try {
    if (navigator.share) await navigator.share({ title: game.title, url: link });
    else { await navigator.clipboard.writeText(link); toast('Link copied'); }
  } catch {}
}

function play(game) {
  const frame = player(game);
  const save = el('button', { type: 'button', class: 'pill', onclick: () => { toggleSaved(game.id); save.textContent = isSaved(game.id) ? '⚑ Saved' : '⚐ Save'; } }, isSaved(game.id) ? '⚑ Saved' : '⚐ Save');
  const others = games.filter((g) => g.id !== game.id);
  return [el('div', { class: 'watch' },
    el('section', {},
      frame,
      el('h1', {}, game.title),
      el('div', { class: 'actions' },
        el('span', { class: 'avatar' }, game.author[0]),
        el('strong', {}, game.author),
        el('span', { class: 'spacer' }),
        game.embed && el('button', { type: 'button', class: 'pill', onclick: () => frame.requestFullscreen?.() }, '⤢ Fullscreen'),
        el('a', { class: 'pill', href: game.url, target: '_blank', rel: 'noopener' }, '↗ Open'),
        el('button', { type: 'button', class: 'pill', onclick: () => share(game) }, 'Share'),
        save),
      el('p', { class: 'about' }, game.description)),
    el('div', { class: 'next' },
      el('h2', {}, 'Up next'),
      ...others.map(card)))];
}

function feed() {
  return [el('div', { class: 'feed' }, ...games.filter(matches).map((g) => el('article', {},
    el('a', { href: `/play/${g.id}`, 'data-nav': '' }, el('img', { class: 'thumb', src: g.thumb, alt: '' }), el('h3', {}, g.title)),
    el('p', {}, g.description))))];
}

function how() {
  return [el('div', { class: 'prose' },
    el('h1', {}, 'How Games works'),
    el('p', {}, 'Games is a list of browser games and playable pages. Each one is hosted by its own author.'),
    el('p', {}, 'The whole catalog is one file, catalog.json. To add a game, open a pull request that adds an entry to it.'),
    el('p', {}, 'Sign in with GitHub to keep a saved list under your name. Saved games stay in this browser.'),
    el('a', { class: 'pill light', href: 'https://github.com/flisk-sh/games#add-a-game', target: '_blank', rel: 'noopener' }, '＋ Add a game'))];
}

function render() {
  const path = location.pathname;
  const game = path.startsWith('/play/') ? games.find((g) => g.id === path.slice(6)) : null;
  let content;
  if (path === '/') content = home();
  else if (game) content = play(game);
  else if (path === '/feed') content = feed();
  else if (path === '/saved') content = [grid(games.filter((g) => isSaved(g.id) && matches(g)), 'Nothing saved yet', 'Press Save on a game to keep it here.')];
  else if (path === '/how') content = how();
  else content = [empty('Page not found', 'That game is not in the catalog.')];
  view.replaceChildren(...content);
  document.title = game ? `${game.title} · Games` : 'Games · Play in your browser';
  document.body.classList.toggle('watching', Boolean(game));
  for (const a of document.querySelectorAll('aside a[data-nav]')) a.toggleAttribute('aria-current', a.getAttribute('href') === path);
}

function go(path) {
  history.pushState(null, '', path);
  render();
  scrollTo(0, 0);
}

function account() {
  if (!user) {
    const next = encodeURIComponent(location.pathname);
    return [el('a', { class: 'pill accent', href: `/auth/start?next=${next}`, onclick: (e) => { e.currentTarget.href = `/auth/start?next=${encodeURIComponent(location.pathname)}`; } }, 'Sign in with GitHub')];
  }
  return [
    el('img', { class: 'avatar', src: `https://github.com/${user.login}.png?size=64`, alt: '' }),
    el('span', { class: 'login' }, user.login),
    el('button', { type: 'button', class: 'pill', onclick: async () => { await fetch('/auth/out', { method: 'POST' }); user = null; $('#account').replaceChildren(...account()); render(); } }, 'Sign out'),
  ];
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-nav]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  go(a.getAttribute('href'));
});
addEventListener('popstate', render);
$('#search').addEventListener('input', () => { if (location.pathname.startsWith('/play/') || location.pathname === '/how') go('/'); else render(); });
$('#menu').addEventListener('click', () => document.body.classList.toggle('menu'));

const theme = store.get('theme', null);
if (theme) document.documentElement.dataset.theme = theme;
$('#theme').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  store.set('theme', next);
});

const me = fetch('/api/me').then((r) => r.json()).then((d) => d.user).catch(() => null);
try {
  games = await fetch('/catalog.json').then((r) => r.json());
  render();
} catch {
  view.replaceChildren(empty('Could not load the games', 'Reload the page to try again.'));
}
user = await me;
$('#account').replaceChildren(...account());
if (user && location.pathname === '/saved') render();
if (new URLSearchParams(location.search).get('signin') === 'failed') toast('Sign-in did not work. Try again.');
