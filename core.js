/* App core: immutable store, formatting, delegation, routing, overlays, command palette. */
(function (root) {
  "use strict";
  const PT = root.PT;
  const D = root.PTData;
  const STORE_KEY = "proptech-v2";

  const App = { actions: {}, inputs: {}, views: {}, state: null };

  // ---------- Formatting ----------
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  App.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ESC[c]);
  App.brl = (n, dec = 0) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: dec, maximumFractionDigits: dec });
  App.num = (n, dec = 0) => Number(n).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  App.pct = (x, dec = 0) => App.num(x * 100, dec) + "%";
  App.money = (n) => {
    const a = Math.abs(n);
    if (a >= 1e6) return "R$ " + App.num(n / 1e6, 2) + " mi";
    if (a >= 1e4) return "R$ " + App.num(n / 1e3, 0) + " mil";
    return App.brl(n);
  };
  App.mil = (n) => App.num(n / 1000, n % 1000 === 0 ? 0 : 1) + " mil";
  App.time = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  App.day = (iso) => {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "");
  };
  App.uid = (p) => p + "_" + Math.random().toString(36).slice(2, 8);

  // ---------- Initial state ----------
  function seedLedger() {
    return D.SEED_EVENTS.reduce((l, e) => PT.ingestPaymentEvent(l, PT.signEvent(e)).ledger, PT.emptyLedger());
  }

  function initialState() {
    return {
      view: "morador",
      city: "ld",
      theme: "auto",
      favs: [],
      sort: "custo",
      mapOpen: false,
      filters: { q: "", bairros: [], maxTotal: 4500, quartos: 0, verificados: false },
      selectedId: null,
      pickedSlot: null,
      listings: D.LISTINGS.map((l) => ({ ...l })),
      slots: D.makeSlots(D.LISTINGS, new Date()),
      visits: [],
      flow: { listingId: null, opened: false },
      proposal: null,
      contract: null,
      vistoria: null,
      payment: "nenhum",
      repasse: null,
      ledger: seedLedger(),
      consoleLog: D.SEED_EVENTS.map((e) => ({ ts: "08:12:04", result: "aplicado", text: `${e.id} · pagamento ${e.contractId} · ${App.brl(e.amount)}` })),
      audit: [{ ts: "08:00:00", who: "sistema", what: "Piloto aberto: Bairros A e B (fase 1)." }],
      sim: { h: 2.8, q: 0.25, u: 0.2, c: 0.08, gSC: 0.3, gLD: 0.15, L: 2000, tau: 0.1, v: 60, F: 20000, d: 0.01, horizon: 30, budget: "min", dev: 20000, G: 7000, A: 10, w: [0.25, 0.2, 0.2, 0.2, 0.15], notas: { sc: [3.5, 3, 4, 3, 3.5], ld: [4, 3.5, 3.5, 3.5, 3] } },
      inv: { perfil: "moderado", selic: 14.75, yieldFII: 10.5, inicial: 20000, mensal: 1000, yieldAA: 0.105, valAA: 0.015, anos: 20, checklist: [] },
      avmIn: { bairro: "A", tipo: "Apartamento", area: 70, conservacao: "normal" },
      cap: { D: 20, s: 3, b: 1, eta: 0.8, presence: 0.75, proposal: 0.2, activation: 0.4, target: 10 },
    };
  }

  function load() {
    const base = initialState();
    try {
      const raw = root.localStorage && root.localStorage.getItem(STORE_KEY);
      if (!raw) return base;
      const saved = JSON.parse(raw);
      return { ...base, ...saved, selectedId: null, pickedSlot: null, sim: { ...base.sim, ...(saved.sim || {}) }, cap: { ...base.cap, ...(saved.cap || {}) }, inv: { ...base.inv, ...(saved.inv || {}) }, avmIn: { ...base.avmIn, ...(saved.avmIn || {}) }, filters: { ...base.filters, ...(saved.filters || {}) } };
    } catch (_) {
      return base;
    }
  }

  let saveTimer = null;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { root.localStorage.setItem(STORE_KEY, JSON.stringify(App.state)); } catch (_) { /* storage unavailable: demo still works */ }
    }, 250);
  }

  App.reset = () => {
    try { root.localStorage.removeItem(STORE_KEY); } catch (_) { /* ignore */ }
    App.state = initialState();
    App.render();
    App.toast("Demonstração reiniciada.", "good");
  };

  // ---------- Store ----------
  App.set = (patch, opts = {}) => {
    const next = typeof patch === "function" ? patch(App.state) : patch;
    App.state = { ...App.state, ...next };
    persist();
    if (opts.render !== false) App.render();
  };

  App.withAudit = (s, who, what) => ({ audit: [{ ts: App.time(), who, what }, ...s.audit].slice(0, 80) });

  // ---------- Derived ----------
  App.listing = (s, id) => s.listings.find((l) => l.id === id);
  App.city = (s) => D.CITIES[s.city];
  App.cityG = (s, id) => (id === "sc" ? s.sim.gSC : s.sim.gLD);
  App.flowListing = (s) => (s.flow.listingId ? App.listing(s, s.flow.listingId) : null);
  App.ownerViewer = (s) => {
    const fl = App.flowListing(s);
    return { role: "proprietario", account: fl ? fl.ownerAccount : D.VIEWERS.proprietario.account };
  };
  App.myVisits = (s) => s.visits.filter((v) => v.account === D.VIEWERS.morador.account);

  App.cycle = (s) => {
    const steps = [
      { k: "Busca", done: s.flow.opened || s.visits.length > 0 },
      { k: "Visita", done: s.visits.some(PT.isConfirmedVisit) },
      { k: "Proposta", done: Boolean(s.proposal && s.proposal.acceptedVersion !== null) },
      { k: "Contrato", done: Boolean(s.contract && s.contract.status === "ativo") },
      { k: "Vistoria", done: Boolean(s.vistoria) },
      { k: "1º repasse", full: "1º repasse conciliado", done: Boolean(s.repasse && s.repasse.status !== "previsto") },
    ];
    const now = steps.findIndex((x) => !x.done);
    return steps.map((x, i) => ({ ...x, now: i === now }));
  };

  // ---------- Toasts ----------
  App.toast = (msg, kind = "") => {
    const box = document.getElementById("toasts");
    const el = document.createElement("div");
    el.className = "toast " + kind;
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  };

  // ---------- Shell rendering ----------
  const NAV = [
    { id: "morador", label: "Alugar", short: "Alugar", icon: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>' },
    { id: "dono", label: "Proprietário", short: "Dono", icon: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5"/>' },
    { id: "operacao", label: "Operação", icon: '<rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="15" width="7" height="5" rx="1.5"/><path d="M14 17.5h7"/>' },
    { id: "investir", label: "Investir", icon: '<path d="M3 17l5-5 4 4 8-8"/><path d="M15 8h5v5"/>' },
    { id: "viabilidade", label: "Viabilidade", short: "Modelos", icon: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>' },
  ];
  App.NAV = NAV;

  function renderShell(s) {
    document.getElementById("nav").innerHTML = NAV.map((n) =>
      `<button data-action="nav" data-view="${n.id}" ${s.view === n.id ? 'aria-current="page"' : ""}>${n.label}</button>`).join("");
    document.getElementById("tabbar").innerHTML = NAV.map((n) =>
      `<button data-action="nav" data-view="${n.id}" ${s.view === n.id ? 'aria-current="page"' : ""}><svg viewBox="0 0 24 24" aria-hidden="true">${n.icon}</svg><span>${n.short || n.label}</span></button>`).join("");
    const sel = document.getElementById("citySel");
    sel.innerHTML = Object.values(D.CITIES).map((c) => `<option value="${c.id}" ${s.city === c.id ? "selected" : ""}>${c.nome}, ${c.uf}</option>`).join("");
  }

  App.render = () => {
    const s = App.state;
    applyTheme(s.theme);
    renderShell(s);
    const view = App.views[s.view] || App.views.morador;
    const main = document.getElementById("main");
    const scroll = root.scrollY;
    const entering = App._sameView !== s.view;
    main.innerHTML = view.render(s);
    if (entering && main.firstElementChild) main.firstElementChild.classList.add("enter");
    if (view.after) view.after(main, s);
    if (App._sameView === s.view) root.scrollTo(0, scroll);
    App._sameView = s.view;
    if (App.renderSheet) App.renderSheet(s);
  };

  // ---------- Night mode ----------
  // "auto" (default): dark only at night on the viewer's clock (18:00–06:00), light by day.
  // "light" / "dark": explicit choice from the toggle.
  const NIGHT_START = 18;
  const NIGHT_END = 6;
  const isNight = (d = new Date()) => d.getHours() >= NIGHT_START || d.getHours() < NIGHT_END;
  App.isNight = isNight;
  function effective(t) {
    return t === "dark" || t === "light" ? t : isNight() ? "dark" : "light";
  }
  function applyTheme(t) {
    const mode = effective(t);
    document.documentElement.setAttribute("data-theme", mode);
    document.getElementById("app").classList.toggle("is-dark", mode === "dark");
  }
  App.actions.theme = () => {
    const next = effective(App.state.theme) === "dark" ? "light" : "dark";
    App.set({ theme: next });
    App.toast(next === "dark" ? "Modo noturno ativado. Volte ao automático em Comandos." : "Modo claro ativado. Volte ao automático em Comandos.", "good");
  };
  App.setAutoTheme = () => {
    App.set({ theme: "auto" });
    App.toast(`Automático: noturno das ${NIGHT_START}h às ${NIGHT_END}h.`, "good");
  };
  setInterval(() => { if (App.state && App.state.theme === "auto") applyTheme("auto"); }, 60000);

  // ---------- Navigation ----------
  App.go = (view, anchor) => {
    if (!App.views[view]) return;
    closeOverlays(true);
    App._sameView = null;
    const reduce = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let applied = false;
    const apply = () => { if (!applied) { applied = true; App.set({ view }); } };
    if (document.startViewTransition && !reduce && App.state.view !== view) {
      try {
        const t = document.startViewTransition(apply);
        [t.ready, t.finished, t.updateCallbackDone].forEach((p) => p && p.catch(() => {})); // a skipped transition is not an error
      } catch (_) { apply(); }
      setTimeout(apply, 120); // never let navigation wait on an animation the browser may skip
    } else apply();
    try { history.replaceState(null, "", "#" + view); } catch (_) { /* sandboxed */ }
    root.scrollTo(0, 0);
    if (anchor) setTimeout(() => { const t = document.getElementById(anchor); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60);
  };
  App.actions.nav = (el, ev) => { ev.preventDefault(); App.go(el.dataset.view, el.dataset.anchor); };
  App.inputs.city = (el) => {
    const id = D.CITIES[el.value] ? el.value : "ld";
    App.set((s) => ({ city: id, ...App.withAudit(s, "direção", "Cenário alterado para " + D.CITIES[id].nome + ".") }));
  };
  App.actions.reset = () => App.reset();

  // ---------- Overlays ----------
  function closeOverlays(keepCopilot) {
    ["sheet", "palette"].forEach((id) => { document.getElementById(id).hidden = true; });
    if (keepCopilot !== true && App.closeCopilot) App.closeCopilot();
    document.getElementById("scrim").hidden = true;
    if (App.state && App.state.selectedId) App.set({ selectedId: null });
  }
  App.closeOverlays = closeOverlays;
  App.actions["close-overlays"] = () => closeOverlays();

  // ---------- Command palette ----------
  let paletteIndex = 0;
  function commands() {
    const s = App.state;
    const base = [
      ...NAV.map((n) => ({ label: "Ir para " + n.label, hint: "visão", run: () => App.go(n.id) })),
      ...Object.values(D.CITIES).map((c) => ({ label: "Cenário: " + c.nome, hint: "cidade", run: () => App.set({ city: c.id }) })),
      { label: "Abrir copiloto de IA", hint: "IA", run: () => App.openCopilot && App.openCopilot() },
      { label: "Alternar modo noturno", hint: "tema", run: () => App.actions.theme() },
      { label: "Modo noturno automático (só à noite)", hint: "tema", run: () => App.setAutoTheme() },
      { label: "Viabilidade · Praça", hint: "seção", run: () => App.go("viabilidade", "sec-praca") },
      { label: "Viabilidade · Carteira e equilíbrio", hint: "seção", run: () => App.go("viabilidade", "sec-carteira") },
      { label: "Viabilidade · Crescimento", hint: "seção", run: () => App.go("viabilidade", "sec-crescimento") },
      { label: "Viabilidade · Orçamento e caixa", hint: "seção", run: () => App.go("viabilidade", "sec-caixa") },
      { label: "Viabilidade · Execução em 14 semanas", hint: "seção", run: () => App.go("viabilidade", "sec-execucao") },
      { label: "Operação · Fila de eventos", hint: "seção", run: () => App.go("operacao", "sec-eventos") },
      { label: "Operação · Capacidade da agenda", hint: "seção", run: () => App.go("operacao", "sec-capacidade") },
      { label: "Reiniciar demonstração", hint: "dados", run: () => App.reset() },
    ];
    const listings = PT.publicListings(s.listings).map((l) => ({ label: "Abrir " + l.titulo, hint: l.bairro ? "Bairro " + l.bairro : "", run: () => App.openListing && App.openListing(l.id) }));
    return [...base, ...listings];
  }
  function renderPalette(q) {
    const pal = document.getElementById("palette");
    const list = commands().filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));
    paletteIndex = Math.min(paletteIndex, Math.max(0, list.length - 1));
    pal.querySelector("ul").innerHTML = list.length
      ? list.map((c, i) => `<li role="option" data-i="${i}" aria-selected="${i === paletteIndex}"><span>${App.esc(c.label)}</span><small>${App.esc(c.hint)}</small></li>`).join("")
      : `<li aria-selected="false"><span class="muted">Nenhum comando encontrado.</span></li>`;
    pal._list = list;
  }
  App.openPalette = () => {
    const pal = document.getElementById("palette");
    pal.innerHTML = `<input id="paletteInput" type="text" placeholder="Buscar comando, imóvel ou seção…" autocomplete="off" aria-label="Buscar comando"><ul role="listbox"></ul>`;
    pal.hidden = false;
    document.getElementById("scrim").hidden = false;
    paletteIndex = 0;
    renderPalette("");
    const input = document.getElementById("paletteInput");
    input.focus();
    input.addEventListener("input", () => { paletteIndex = 0; renderPalette(input.value); });
    input.addEventListener("keydown", (e) => {
      const list = pal._list || [];
      if (e.key === "ArrowDown") { e.preventDefault(); paletteIndex = Math.min(list.length - 1, paletteIndex + 1); renderPalette(input.value); }
      if (e.key === "ArrowUp") { e.preventDefault(); paletteIndex = Math.max(0, paletteIndex - 1); renderPalette(input.value); }
      if (e.key === "Enter" && list[paletteIndex]) { const cmd = list[paletteIndex]; closeOverlays(); cmd.run(); }
    });
    pal.querySelector("ul").addEventListener("click", (e) => {
      const li = e.target.closest("li[data-i]");
      if (!li) return;
      const cmd = (pal._list || [])[Number(li.dataset.i)];
      closeOverlays();
      if (cmd) cmd.run();
    });
  };
  App.actions.palette = () => App.openPalette();

  // ---------- Delegation ----------
  function bind() {
    document.addEventListener("click", (e) => {
      const el = e.target.closest("[data-action]");
      if (!el) return;
      const fn = App.actions[el.dataset.action];
      if (fn) fn(el, e);
    });
    const onInput = (e) => {
      const el = e.target.closest("[data-input]");
      if (!el) return;
      const fn = App.inputs[el.dataset.input];
      if (fn) fn(el, e);
    };
    document.addEventListener("input", onInput);
    document.addEventListener("keydown", (e) => {
      const el = e.target.closest && e.target.closest('[role="button"][data-action]');
      if (el && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); el.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
    });
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); App.openPalette(); }
      if (e.key === "Escape") closeOverlays();
    });
  }

  App.boot = () => {
    App.state = load();
    const hash = (root.location.hash || "").replace("#", "");
    if (App.views[hash]) App.state = { ...App.state, view: hash };
    bind();
    App.render();
    const top = document.querySelector(".top");
    const onScroll = () => top.classList.toggle("scrolled", root.scrollY > 8);
    root.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  };

  root.App = App;
})(typeof self !== "undefined" ? self : this);
