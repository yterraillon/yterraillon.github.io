(() => {
  'use strict';

  const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const STORAGE_KEY = 'mealPicker.week';

  const $ = (id) => document.getElementById(id);

  let meals = [];
  let byId = new Map();
  let week = [];        // array of meal ids, one per day
  let lastSingle = null;

  // ---------- Rules (extension point) ----------

  // Returns true if `meal` may be picked in this context.
  // context: { week: [ids], dayIndex: number|null }
  // v1: every meal is eligible. Future rules go here.
  function eligible(meal, context) {
    return true;
  }

  // ---------- Picking ----------

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickOne(excludeIds = [], context = { week: [], dayIndex: null }) {
    const excluded = new Set(excludeIds);
    let pool = meals.filter((m) => !excluded.has(m.id) && eligible(m, context));
    if (pool.length === 0) pool = meals.filter((m) => !excluded.has(m.id));
    if (pool.length === 0) pool = meals;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function pickWeek(n = DAYS.length) {
    const result = [];
    for (let i = 0; i < n; i++) {
      result.push(pickOne(result, { week: result, dayIndex: i }).id);
    }
    return result;
  }

  function rerollDay(i) {
    const others = week.filter((_, k) => k !== i);
    const next = pickOne([...others, week[i]], { week, dayIndex: i });
    week[i] = next.id;
    saveWeek();
    renderWeek();
  }

  // ---------- Storage ----------

  function saveWeek() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ids: week, date: new Date().toISOString() }));
    } catch (e) {}
  }

  function loadWeek() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!s || !Array.isArray(s.ids)) return null;
      return s;
    } catch (e) {
      return null;
    }
  }

  // ---------- Rendering ----------

  function show(el, visible) { el.classList.toggle('hidden', !visible); }

  function renderSingle(meal) {
    lastSingle = meal.id;
    $('single-name').textContent = meal.nom;
    show($('single'), true);
  }

  function formatDate(iso) {
    const d = iso ? new Date(iso) : new Date();
    if (isNaN(d)) return '';
    return 'tiré le ' + d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  }

  function renderWeek(dateIso) {
    const list = $('week');
    list.innerHTML = '';
    week.forEach((id, i) => {
      const li = document.createElement('li');
      li.className = 'day';

      const dname = document.createElement('span');
      dname.className = 'dname';
      dname.textContent = DAYS[i];

      const meal = document.createElement('span');
      meal.className = 'meal';
      meal.textContent = byId.get(id).nom;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ghost icon';
      btn.textContent = '🔄';
      btn.title = `Changer le repas de ${DAYS[i].toLowerCase()}`;
      btn.setAttribute('aria-label', btn.title);
      btn.addEventListener('click', () => rerollDay(i));

      li.append(dname, meal, btn);
      list.appendChild(li);
    });
    if (dateIso !== undefined) $('week-date').textContent = formatDate(dateIso);
    show($('week-card'), true);
  }

  function newWeek() {
    week = pickWeek();
    saveWeek();
    renderWeek(new Date().toISOString());
  }

  // ---------- Copy ----------

  function weekAsText() {
    return week.map((id, i) => `${DAYS[i]} : ${byId.get(id).nom}`).join('\n');
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (err) {}
      ta.remove();
      return ok;
    }
  }

  async function onCopy() {
    const btn = $('btn-copy');
    const ok = await copyText(weekAsText());
    btn.textContent = ok ? 'Copié ✓' : 'Échec de la copie';
    setTimeout(() => { btn.textContent = '📋 Copier'; }, 1500);
  }

  // ---------- Init ----------

  async function loadMeals() {
    const res = await fetch('./meals.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.meals || [];
  }

  async function init() {
    try {
      meals = await loadMeals();
      if (meals.length === 0) throw new Error('liste vide');
    } catch (e) {
      const err = $('error');
      err.textContent = `Impossible de charger les repas (${e.message}).`;
      show(err, true);
      return;
    }
    byId = new Map(meals.map((m) => [m.id, m]));

    $('btn-one').disabled = false;
    $('btn-week').disabled = false;

    $('btn-one').addEventListener('click', () => renderSingle(pickOne()));
    $('btn-one-again').addEventListener('click', () => renderSingle(pickOne(lastSingle ? [lastSingle] : [])));
    $('btn-week').addEventListener('click', newWeek);
    $('btn-new-week').addEventListener('click', newWeek);
    $('btn-copy').addEventListener('click', onCopy);

    // Restore the last week, replacing ids that no longer exist.
    const saved = loadWeek();
    if (saved) {
      week = DAYS.map((_, i) => (byId.has(saved.ids[i]) ? saved.ids[i] : null));
      week.forEach((id, i) => {
        if (id === null) week[i] = pickOne(week.filter(Boolean), { week, dayIndex: i }).id;
      });
      if (week.some((id, i) => id !== saved.ids[i])) saveWeek();
      renderWeek(saved.date);
    }
  }

  init();
})();
