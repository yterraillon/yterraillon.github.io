(() => {
  'use strict';

  const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const STORAGE_KEY = 'mealPicker.week';
  const MAX_SAME_PROTEIN = 2;

  const $ = (id) => document.getElementById(id);

  let meals = [];
  let byId = new Map();
  // store.current / store.previous: { isoWeek: '2026-W45', date: ISO string, days: [{ main, extra }] }
  let store = { current: null, previous: null };
  let single = null;    // { main, extra } shown in the "Un repas" card

  // ---------- Helpers ----------

  const isCecile = (meal) => Array.isArray(meal.tags) && meal.tags.includes('cecile');

  function isoWeek(date) {
    const t = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const year = t.getUTCFullYear();
    const week = Math.ceil(((t - Date.UTC(year, 0, 1)) / 864e5 + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }

  // Meal ids of a list of days (main + extra).
  function dayIds(days) {
    const ids = [];
    for (const d of days) {
      if (d.main) ids.push(d.main);
      if (d.extra) ids.push(d.extra);
    }
    return ids;
  }

  const toMeals = (ids) => ids.map((id) => byId.get(id)).filter(Boolean);

  // Ids of the week before the current calendar week.
  function lastWeekIds() {
    const cur = store.current;
    if (cur && cur.isoWeek < isoWeek(new Date())) return dayIds(cur.days);
    return store.previous ? dayIds(store.previous.days) : [];
  }

  // Ids of the week before the menu currently displayed (used when re-rolling a day).
  const previousWeekIds = () => (store.previous ? dayIds(store.previous.days) : []);

  // ---------- Rules ----------

  // Rules from weakest to strongest: when no meal passes them all,
  // they are relaxed in this order (first one dropped first).
  const RULES = [
    { name: 'legume', test: (m, ctx) => m.cleLegume == null || !ctx.legumes.has(m.cleLegume) },
    { name: 'proteine', test: (m, ctx) => m.cleProteine == null || (ctx.proteines.get(m.cleProteine) || 0) < MAX_SAME_PROTEIN },
    { name: 'semaine-precedente', test: (m, ctx) => !ctx.lastWeek.has(m.id) },
  ];

  // opts: { taken: [meals already in the week], exclude: [ids never allowed],
  //         lastWeek: [ids], noCecile: bool }
  function pickMeal({ taken = [], exclude = [], lastWeek = [], noCecile = false }) {
    const excluded = new Set([...exclude, ...taken.map((m) => m.id)]);
    const ctx = {
      lastWeek: new Set(lastWeek),
      legumes: new Set(taken.map((m) => m.cleLegume).filter((k) => k != null)),
      proteines: new Map(),
    };
    for (const m of taken) {
      if (m.cleProteine != null) ctx.proteines.set(m.cleProteine, (ctx.proteines.get(m.cleProteine) || 0) + 1);
    }

    const hard = meals.filter((m) => !excluded.has(m.id) && !(noCecile && isCecile(m)));
    for (let drop = 0; drop <= RULES.length; drop++) {
      const active = RULES.slice(drop);
      const pool = hard.filter((m) => active.every((r) => r.test(m, ctx)));
      if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
    }
    // Nothing left at all (tiny meal list): fall back to anything.
    const any = meals.filter((m) => !(noCecile && isCecile(m)));
    const pool = any.length ? any : meals;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Picks the main dish and, for a "Cécile" dish, a second one.
  function pickDay({ taken, exclude = [], lastWeek }) {
    const main = pickMeal({ taken, exclude, lastWeek });
    const extra = isCecile(main)
      ? pickMeal({ taken: [...taken, main], exclude, lastWeek, noCecile: true })
      : null;
    return { main: main.id, extra: extra ? extra.id : null };
  }

  function pickWeek(lastWeek) {
    const days = [];
    for (let i = 0; i < DAYS.length; i++) {
      days.push(pickDay({ taken: toMeals(dayIds(days)), lastWeek }));
    }
    return days;
  }

  const otherDays = (days, i) => days.filter((_, k) => k !== i);

  function rerollMain(i) {
    const days = store.current.days;
    days[i] = pickDay({
      taken: toMeals(dayIds(otherDays(days, i))),
      exclude: [days[i].main],
      lastWeek: previousWeekIds(),
    });
    saveStore();
    renderWeek();
  }

  function rerollExtra(i) {
    const days = store.current.days;
    const extra = pickMeal({
      taken: toMeals([...dayIds(otherDays(days, i)), days[i].main]),
      exclude: days[i].extra ? [days[i].extra] : [],
      lastWeek: previousWeekIds(),
      noCecile: true,
    });
    days[i].extra = extra.id;
    saveStore();
    renderWeek();
  }

  function newWeek() {
    const now = new Date();
    const thisWeek = isoWeek(now);
    const lastWeek = lastWeekIds();
    if (store.current && store.current.isoWeek < thisWeek) store.previous = store.current;
    store.current = { isoWeek: thisWeek, date: now.toISOString(), days: pickWeek(lastWeek) };
    saveStore();
    renderWeek();
  }

  function pickSingle() {
    const exclude = single ? [single.main] : [];
    single = pickDay({ taken: [], exclude, lastWeek: lastWeekIds() });
    renderSingle();
  }

  // ---------- Storage ----------

  function saveStore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, ...store }));
    } catch (e) {}
  }

  function readStore() {
    let raw;
    try {
      raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
      return null;
    }
    if (!raw || typeof raw !== 'object') return null;

    const validWeek = (w) => w && Array.isArray(w.days) ? w : null;
    const weekOf = (date) => {
      const d = new Date(date);
      return isoWeek(isNaN(d) ? new Date() : d);
    };

    // V1 format: { ids: [...], date }
    if (Array.isArray(raw.ids)) {
      return {
        current: { isoWeek: weekOf(raw.date), date: raw.date, days: raw.ids.map((id) => ({ main: id, extra: null })) },
        previous: null,
      };
    }
    const current = validWeek(raw.current);
    const previous = validWeek(raw.previous);
    if (current && typeof current.isoWeek !== 'string') current.isoWeek = weekOf(current.date);
    if (previous && typeof previous.isoWeek !== 'string') previous.isoWeek = weekOf(previous.date);
    return { current, previous };
  }

  // Fixes a stored week against the current meal list: re-picks unknown ids,
  // adds the missing second dish of a "Cécile" day, removes a stray one.
  function normalizeWeek(week, lastWeek) {
    const days = DAYS.map((_, i) => {
      const d = week.days[i] || {};
      return { main: byId.has(d.main) ? d.main : null, extra: byId.has(d.extra) ? d.extra : null };
    });
    days.forEach((d, i) => {
      const others = toMeals(dayIds(otherDays(days, i)));
      if (!d.main) {
        days[i] = pickDay({ taken: others, lastWeek });
        return;
      }
      const main = byId.get(d.main);
      if (isCecile(main) && (!d.extra || isCecile(byId.get(d.extra)))) {
        d.extra = pickMeal({ taken: [...others, main], lastWeek, noCecile: true }).id;
      } else if (!isCecile(main)) {
        d.extra = null;
      }
    });
    week.days = days;
  }

  // ---------- Rendering ----------

  function show(el, visible) { el.classList.toggle('hidden', !visible); }

  function badge() {
    const b = document.createElement('span');
    b.className = 'badge';
    b.textContent = 'Cécile';
    return b;
  }

  function renderSingle() {
    const main = byId.get(single.main);
    const name = $('single-name');
    name.textContent = main.nom;
    if (isCecile(main)) name.append(' ', badge());

    const extra = single.extra ? byId.get(single.extra) : null;
    $('single-extra').textContent = extra ? `+ ${extra.nom}` : '';
    show($('single-extra'), !!extra);
    show($('single'), true);
  }

  function formatDate(iso) {
    const d = iso ? new Date(iso) : new Date();
    if (isNaN(d)) return '';
    return 'tiré le ' + d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  }

  function rerollButton(label, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ghost icon';
    btn.textContent = '🔄';
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.addEventListener('click', onClick);
    return btn;
  }

  function dayRow(className, dayLabel, content, button) {
    const li = document.createElement('li');
    li.className = className;
    const dname = document.createElement('span');
    dname.className = 'dname';
    dname.textContent = dayLabel;
    const meal = document.createElement('span');
    meal.className = 'meal';
    meal.append(...content);
    li.append(dname, meal, button);
    return li;
  }

  function renderWeek() {
    const list = $('week');
    list.innerHTML = '';
    store.current.days.forEach((d, i) => {
      const main = byId.get(d.main);
      const content = isCecile(main) ? [main.nom, ' ', badge()] : [main.nom];
      list.appendChild(dayRow(
        d.extra ? 'day has-extra' : 'day',
        DAYS[i],
        content,
        rerollButton(`Changer le repas de ${DAYS[i].toLowerCase()}`, () => rerollMain(i)),
      ));
      if (d.extra) {
        list.appendChild(dayRow(
          'day extra',
          '',
          [`+ ${byId.get(d.extra).nom}`],
          rerollButton(`Changer le 2nd plat de ${DAYS[i].toLowerCase()}`, () => rerollExtra(i)),
        ));
      }
    });
    $('week-date').textContent = formatDate(store.current.date);
    show($('week-card'), true);
  }

  // ---------- Copy ----------

  function weekAsText() {
    return store.current.days.map((d, i) => {
      const main = byId.get(d.main);
      let line = `${DAYS[i]} : ${main.nom}`;
      if (isCecile(main)) line += ' (Cécile)';
      if (d.extra) line += ` + ${byId.get(d.extra).nom}`;
      return line;
    }).join('\n');
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

    $('btn-one').addEventListener('click', pickSingle);
    $('btn-one-again').addEventListener('click', pickSingle);
    $('btn-week').addEventListener('click', newWeek);
    $('btn-new-week').addEventListener('click', newWeek);
    $('btn-copy').addEventListener('click', onCopy);

    const saved = readStore();
    if (saved) {
      store = saved;
      if (store.current) {
        normalizeWeek(store.current, previousWeekIds());
        renderWeek();
      }
      saveStore(); // also migrates the V1 format
    }
  }

  init();
})();
