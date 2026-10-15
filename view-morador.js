/* Alugar (morador): illustrated hero search, art cards, map, visit windows, versioned proposals. */
(function (root) {
  "use strict";
  const { App, PT, PTData: D, Art } = root;
  const esc = App.esc;
  const ME = D.VIEWERS.morador;
  const ICON = {
    seal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 6v6c0 4.4 3.4 8.3 8 9 4.6-.7 8-4.6 8-9V6Z"/><path d="m8.5 12 2.4 2.4 4.6-4.8"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 4-5 2v14l5-2 6 2 5-2V4l-5 2-6-2Z"/><path d="M9 4v14M15 6v14"/></svg>',
    list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
    spark: '<svg class="spark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7Z"/></svg>',
  };
  const MAP_LBL = { A: [48, 58, "start"], B: [600, 112, "end"], C: [184, 306, "middle"], D: [470, 306, "middle"] };
  const SORTS = { custo: "Menor custo total", area: "Maior área", verificado: "Verificados primeiro" };

  function filtered(s) {
    const f = s.filters;
    const q = f.q.trim().toLowerCase();
    const list = PT.publicListings(s.listings).filter((l) => {
      if (PT.monthlyCost(l).total > f.maxTotal) return false;
      if (f.bairros.length && !f.bairros.includes(l.bairro)) return false;
      if (f.quartos && l.quartos < f.quartos) return false;
      if (f.verificados && !l.verificado) return false;
      if (f.favs && !s.favs.includes(l.id)) return false;
      if (q && !(l.titulo + " " + l.tipo + " " + l.tags.join(" ")).toLowerCase().includes(q)) return false;
      return true;
    });
    const by = {
      custo: (a, b) => PT.monthlyCost(a).total - PT.monthlyCost(b).total,
      area: (a, b) => b.area - a.area,
      verificado: (a, b) => (b.verificado ? 1 : 0) - (a.verificado ? 1 : 0) || PT.monthlyCost(a).total - PT.monthlyCost(b).total,
    };
    return list.slice().sort(by[s.sort] || by.custo);
  }
  App.filteredListings = filtered;

  function costBar(l) {
    const c = PT.monthlyCost(l);
    const keys = ["aluguel", "condominio", "iptu", "seguro"];
    return `<div class="costbar" aria-hidden="true">${c.itens.map((it, i) => (it.v ? `<i class="c-${keys[i]}" style="width:${((it.v / c.total) * 100).toFixed(1)}%"></i>` : "")).join("")}</div>`;
  }
  const shortDate = (iso) => iso.split("-").reverse().slice(0, 2).join("/");

  function card(l, s) {
    const c = PT.monthlyCost(l);
    const fav = s.favs.includes(l.id);
    const inFlow = s.flow.listingId === l.id;
    return `<article class="card ${s.selectedId === l.id ? "active" : ""}">
      <div class="card-media">
        <button class="media-hit" data-action="open-listing" data-id="${l.id}" aria-label="Ver ${esc(l.titulo)}">${Art.facade(l)}</button>
        <div class="badges">${l.verificado ? `<span class="badge good">${ICON.seal}Verificado ${shortDate(l.verificado.data)}</span>` : '<span class="badge">Em verificação</span>'}${inFlow ? '<span class="badge warn">Em negociação</span>' : ""}</div>
        <button class="fav" data-action="fav" data-id="${l.id}" aria-pressed="${fav}" aria-label="${fav ? "Remover dos" : "Salvar nos"} favoritos">${ICON.heart}</button>
      </div>
      <button class="card-body" data-action="open-listing" data-id="${l.id}">
        <span class="price"><b>${App.brl(c.total)}</b> <small>total/mês</small></span>
        <span class="sub">Aluguel ${App.brl(l.aluguel)}</span>
        <span class="title">${esc(l.titulo)}</span>
        <span class="meta">${l.area} m² · ${l.quartos} quarto${l.quartos > 1 ? "s" : ""} · Bairro ${l.bairro}</span>
        ${costBar(l)}
      </button>
    </article>`;
  }

  function mapSvg(s, list) {
    const ids = new Set(list.map((l) => l.id));
    const pins = PT.publicListings(s.listings).filter((l) => ids.has(l.id));
    const bairros = D.BAIRROS.map((b) => {
      const on = s.filters.bairros.includes(b.id);
      return `<polygon class="bairro f${b.fase} ${on ? "on" : ""}" points="${b.poly}" data-action="filter-bairro" data-b="${b.id}"><title>${b.nome} · Fase ${b.fase}</title></polygon>
        <text class="lbl" x="${MAP_LBL[b.id][0]}" y="${MAP_LBL[b.id][1]}" text-anchor="${MAP_LBL[b.id][2]}" pointer-events="none">${b.nome}</text>`;
    }).join("");
    const pinSvg = pins.map((l) => {
      const sel = s.selectedId === l.id || s.flow.listingId === l.id;
      const label = App.num(PT.monthlyCost(l).total / 1000, 1) + " mil";
      const w = label.length * 8.6 + 22;
      return `<g class="pin ${sel ? "sel" : ""}" data-action="open-listing" data-id="${l.id}" transform="translate(${l.x} ${l.y})" tabindex="0" role="button" aria-label="${esc(l.titulo)}, ${label}">
        <rect x="${-w / 2}" y="-36" width="${w}" height="30" rx="15"/><path d="M-6 -7 0 0 6 -7Z"/><text x="0" y="-16" text-anchor="middle">${label}</text></g>`;
    }).join("");
    return `<svg class="map" viewBox="0 0 640 420" role="img" aria-label="Mapa esquemático, sem escala, bairros fictícios">
      <rect width="640" height="420" class="land"/>
      ${bairros}
      <path class="road main" d="M10 204 C 200 190, 420 216, 630 206"/><path class="road main" d="M326 10 C 318 140, 336 290, 330 410"/>
      <path class="road" d="M40 120 C 160 112, 230 130, 318 116"/><path class="road" d="M336 128 C 430 120, 520 134, 600 126"/>
      <path class="road" d="M160 26 C 170 120, 150 300, 170 392"/><path class="road" d="M470 40 C 480 150, 460 300, 476 392"/>
      <g class="base" transform="translate(${D.BASE.x} ${D.BASE.y})"><circle r="9"/></g>
      ${pinSvg}
    </svg>`;
  }

  function journey(s) {
    const visit = App.myVisits(s).find((v) => PT.isConfirmedVisit(v)) || App.myVisits(s)[0];
    const p = s.proposal;
    const c = s.contract;
    const steps = [
      { n: "Descobrir", st: s.flow.opened ? "Comparou pelo custo total" : "Compare pelo custo total", done: s.flow.opened },
      { n: "Visitar", st: !visit ? "Escolha uma janela" : visit.status === "solicitada" ? "Aguarda confirmação" : "Visita confirmada", done: Boolean(visit && PT.isConfirmedVisit(visit)) },
      { n: "Negociar", st: !p ? "Proponha após a visita" : p.acceptedVersion !== null ? `Aceita · v${p.acceptedVersion}` : `v${p.versions.length} · com o dono`, done: Boolean(p && p.acceptedVersion !== null) },
      { n: "Formalizar", st: !c ? "Contrato e vistoria" : c.status === "ativo" ? (s.vistoria ? "Ativo · vistoria feita" : "Ativo · falta vistoria") : "Assinatura iniciada", done: Boolean(c && c.status === "ativo" && s.vistoria) },
      { n: "Morar", st: s.repasse && s.repasse.status !== "previsto" ? "Pagamento conciliado" : s.payment === "informado" ? "Pagamento informado" : "Chaves e suporte", done: Boolean(s.repasse && s.repasse.status !== "previsto") },
    ];
    const now = steps.findIndex((x) => !x.done);
    const pct = Math.round((steps.filter((x) => x.done).length / steps.length) * 100);
    return `<section class="journey-card" aria-labelledby="jt">
      <div class="jc-head"><div><span class="eyebrow">Sua jornada</span><h2 id="jt">${now === -1 ? "Tudo pronto. Bem-vindo à casa nova." : "Próximo passo: " + steps[now].n.toLowerCase()}</h2></div>
        <span class="jc-pct"><b>${pct}%</b> concluído</span></div>
      <div class="progress" aria-hidden="true"><i style="width:${pct}%"></i></div>
      <ol class="journey">${steps.map((x, i) => `<li class="step ${x.done ? "done" : ""} ${i === now ? "now" : ""}"><span class="dot">${x.done ? "✓" : i + 1}</span><b>${x.n}</b><small>${esc(x.st)}</small></li>`).join("")}</ol>
      <p class="jc-rule">Solicitação de visita não é confirmação. Assinatura iniciada não é contrato concluído. Pagamento informado não é recebimento conciliado.</p>
    </section>`;
  }

  function docs() {
    return D.DOCUMENTS.filter((d) => d.id === "d4" || d.id === "d1").map((d) => {
      const ok = PT.canAccessDocument(ME, d);
      return `<div class="doc"><span>${esc(d.titulo)}</span>${ok ? '<span class="pill good">sua conta</span>' : '<span class="lock">bloqueado · outra conta</span>'}</div>`;
    }).join("");
  }

  function results(s) {
    const list = filtered(s);
    return list.length
      ? list.map((l) => card(l, s)).join("")
      : `<div class="empty">Nenhum imóvel cabe nesses filtros.<br><button class="btn small" data-action="clear-filters">Limpar filtros</button></div>`;
  }

  App.views.morador = {
    render(s) {
      const city = App.city(s);
      const f = s.filters;
      const n = filtered(s).length;
      const bsel = f.bairros.length === 1 ? f.bairros[0] : "";
      return `<div class="view view-home">
        <section class="hero" aria-labelledby="heroTitle">
          <div class="hero-art" id="heroArt">${Art.skyline()}</div>
          <div class="hero-card">
            <div class="seg-tabs" role="tablist"><button role="tab" aria-selected="true">Buscar imóveis</button><button role="tab" aria-selected="false" data-action="nav" data-view="dono">Anunciar imóvel</button></div>
            <h1 id="heroTitle">Alugue um lar com o custo inteiro à vista.</h1>
            <p class="lede">Aluguel, condomínio, IPTU e seguro separados antes da visita. Sem cadastro para buscar.</p>
            <div class="hero-fields">
              <label class="hf" for="fBairro"><span>Bairro</span><select id="fBairro" data-input="filter-bairro-sel"><option value="">Todos os bairros</option>${D.BAIRROS.map((b) => `<option value="${b.id}" ${bsel === b.id ? "selected" : ""}>${b.nome}${b.fase === 2 ? " (fase 2)" : ""}</option>`).join("")}</select></label>
              <label class="hf" for="fQuartos"><span>Quartos</span><select id="fQuartos" data-input="filter-quartos">${[0, 1, 2, 3].map((q) => `<option value="${q}" ${f.quartos === q ? "selected" : ""}>${q ? q + "+ quartos" : "Qualquer"}</option>`).join("")}</select></label>
              <label class="hf wide" for="fMax"><span>Valor total até <output id="fMaxOut">${App.brl(f.maxTotal)}</output></span><input type="range" id="fMax" min="1200" max="4500" step="50" value="${f.maxTotal}" data-input="filter-max"></label>
              <label class="hf wide" for="fQ"><span>Palavra-chave</span><input id="fQ" data-input="filter-q" value="${esc(f.q)}" placeholder="pet, mobiliado, varanda…" autocomplete="off"></label>
            </div>
            <button class="btn primary lg block" data-action="scroll-results" id="heroCta">Ver ${n} imóve${n === 1 ? "l" : "is"}</button>
            <p class="hero-note">Piloto em ${esc(city.nome)}, ${city.uf} · Bairros A e B · dados fictícios</p>
          </div>
        </section>

        ${journey(s)}

        <section class="results" id="resultsTop" aria-labelledby="resTitle">
          <div class="res-head">
            <h2 id="resTitle"><span id="resCount">${n}</span> imóveis para alugar</h2>
            <div class="res-tools">
              <label class="sort" for="fSort"><span class="sr">Ordenar</span><select id="fSort" data-input="sort">${Object.entries(SORTS).map(([k, t]) => `<option value="${k}" ${s.sort === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>
              <button class="btn small map-toggle" data-action="toggle-map" aria-pressed="${s.mapOpen}">${s.mapOpen ? ICON.list + "Lista" : ICON.map + "Mapa"}</button>
            </div>
          </div>
          <div class="chips">${D.BAIRROS.map((b) => `<button class="chip" data-action="filter-bairro" data-b="${b.id}" aria-pressed="${f.bairros.includes(b.id)}">${b.nome}</button>`).join("")}
            <button class="chip" data-action="toggle-ver" aria-pressed="${f.verificados}">${ICON.seal}Verificados</button>
            <button class="chip" data-action="toggle-favs" aria-pressed="${Boolean(f.favs)}">${ICON.heart}Favoritos${s.favs.length ? " · " + s.favs.length : ""}</button>
            <span class="legend"><span><i class="c-aluguel"></i>aluguel</span><span><i class="c-condominio"></i>condomínio</span><span><i class="c-iptu"></i>IPTU</span><span><i class="c-seguro"></i>seguro</span></span></div>
          <div class="results-layout" data-map="${s.mapOpen ? 1 : 0}">
            <div class="listing-grid" id="results">${results(s)}</div>
            <aside class="map-col" aria-label="Mapa e documentos">
              <div class="map-card"><div id="mapBox">${mapSvg(s, filtered(s))}</div><div class="map-legend"><span><i class="lg-f1"></i>Fase 1 · operando</span><span><i class="lg-f2"></i>Fase 2 · em breve</span><span><i class="lg-base"></i>Base da equipe</span></div><p class="map-note">Esquema sem escala, bairros fictícios. Toque num bairro para filtrar.</p></div>
              <div class="panel stack"><div class="panel-head"><h3>Seus documentos</h3><span class="eyebrow">coleta privada</span></div>${docs()}</div>
            </aside>
          </div>
        </section>
      </div>`;
    },
    after(main) { Art.bindParallax(main.querySelector("#heroArt")); },
  };

  function refreshResults() {
    const s = App.state;
    const n = filtered(s).length;
    const put = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    put("results", results(s));
    put("mapBox", mapSvg(s, filtered(s)));
    put("resCount", String(n));
    put("heroCta", `Ver ${n} imóve${n === 1 ? "l" : "is"}`);
  }
  App.refreshResults = refreshResults;
  const setFilter = (patch) => { App.set((s) => ({ filters: { ...s.filters, ...patch } }), { render: false }); refreshResults(); };

  App.inputs["filter-q"] = (el) => setFilter({ q: el.value.slice(0, 80) });
  App.inputs["filter-max"] = (el) => { setFilter({ maxTotal: Number(el.value) }); const o = document.getElementById("fMaxOut"); if (o) o.textContent = App.brl(Number(el.value)); };
  App.inputs["filter-quartos"] = (el) => setFilter({ quartos: Number(el.value) });
  App.inputs["filter-bairro-sel"] = (el) => App.set((s) => ({ filters: { ...s.filters, bairros: el.value ? [el.value] : [] } }));
  App.inputs.sort = (el) => { App.set({ sort: el.value }, { render: false }); refreshResults(); };
  App.actions["filter-bairro"] = (el) => {
    const b = el.dataset.b;
    App.set((s) => ({ filters: { ...s.filters, bairros: s.filters.bairros.includes(b) ? s.filters.bairros.filter((x) => x !== b) : [...s.filters.bairros, b] } }));
  };
  App.actions["toggle-ver"] = () => App.set((s) => ({ filters: { ...s.filters, verificados: !s.filters.verificados } }));
  App.actions["toggle-favs"] = () => App.set((s) => ({ filters: { ...s.filters, favs: !s.filters.favs } }));
  App.actions["toggle-map"] = () => App.set((s) => ({ mapOpen: !s.mapOpen }));
  App.actions["clear-filters"] = () => App.set((s) => ({ filters: { ...s.filters, q: "", bairros: [], maxTotal: 4500, quartos: 0, verificados: false, favs: false } }));
  App.actions["scroll-results"] = () => { const t = document.getElementById("resultsTop"); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); };
  App.actions.fav = (el) => {
    const id = el.dataset.id;
    const on = !App.state.favs.includes(id);
    App.set((s) => ({ favs: on ? [...s.favs, id] : s.favs.filter((x) => x !== id) }), { render: false });
    if (App.state.filters.favs) return refreshResults();
    el.setAttribute("aria-pressed", String(on));
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
    const chip = document.querySelector('[data-action="toggle-favs"]');
    if (chip) chip.lastChild.textContent = "Favoritos" + (App.state.favs.length ? " · " + App.state.favs.length : "");
  };

  // ---------- Listing sheet ----------
  App.openListing = (id) => {
    if (App.state.view !== "morador") App.set({ view: "morador" }, { render: false });
    App.set((s) => ({ selectedId: id, pickedSlot: null, flow: { ...s.flow, opened: true } }));
  };
  App.actions["open-listing"] = (el) => App.openListing(el.dataset.id);
  App.actions["close-sheet"] = () => App.closeOverlays(true);

  function slotsHtml(s, l) {
    const mine = App.myVisits(s).find((v) => v.listingId === l.id && v.status !== "cancelada");
    const slots = s.slots.filter((x) => x.listingId === l.id);
    const days = [...new Set(slots.map((x) => x.day))];
    return `<div class="slots">${days.map((d) => `<div class="slot-day"><span class="day">${esc(App.day(d))}</span>${slots.filter((x) => x.day === d).map((x) => {
      const mineSlot = mine && mine.slotId === x.id;
      const taken = x.visitId && !mineSlot;
      return `<button class="slot" data-action="pick-slot" data-slot="${x.id}" aria-pressed="${mineSlot || s.pickedSlot === x.id}" ${taken || mine ? "disabled" : ""} aria-label="${esc(App.day(d))} ${x.time}${taken ? ", ocupada" : ""}">${x.time}</button>`;
    }).join("")}</div>`).join("")}</div>`;
  }

  function versionsHtml(p) {
    return `<div class="versions">${p.versions.slice().reverse().map((v) => `<div class="ver ${p.acceptedVersion === v.v ? "acc" : ""}"><span class="mono">v${v.v}</span><span>${App.brl(v.aluguel)} · ${v.prazoMeses} meses</span><span class="pill ${p.acceptedVersion === v.v ? "good" : p.acceptedVersion !== null ? "dim" : "warn"}">${p.acceptedVersion === v.v ? "aceita" : p.acceptedVersion !== null ? "contraproposta" : "aguarda"}</span></div>`).join("")}</div>`;
  }
  App.versionsHtml = versionsHtml;

  function proposalHtml(s, l) {
    const visitOk = App.myVisits(s).some((v) => v.listingId === l.id && PT.isConfirmedVisit(v));
    const p = s.proposal && s.proposal.listingId === l.id ? s.proposal : null;
    const last = p ? p.versions[p.versions.length - 1] : { aluguel: l.aluguel, prazoMeses: 30 };
    return `<section class="block"><div class="block-head"><h3>Proposta</h3><span class="eyebrow">versionada</span></div>
      ${visitOk ? "" : '<p class="hint">A proposta abre depois da visita confirmada pela equipe.</p>'}
      <div class="grid cols-2">
        <div class="field"><label for="pAluguel">Aluguel proposto</label><input class="input mono" id="pAluguel" type="number" min="300" max="50000" step="10" value="${last.aluguel}" ${visitOk ? "" : "disabled"}></div>
        <div class="field"><label for="pPrazo">Prazo (meses)</label><input class="input mono" id="pPrazo" type="number" min="12" max="60" step="1" value="${last.prazoMeses}" ${visitOk ? "" : "disabled"}></div>
      </div>
      <div class="row"><button class="btn primary" data-action="send-proposal" data-id="${l.id}" ${visitOk ? "" : "disabled"}>${p ? "Enviar nova versão" : "Enviar proposta"}</button>
        ${p && p.acceptedVersion !== null ? '<span class="hint">Valores da proposta aceita ficam mantidos.</span>' : ""}</div>
      ${p ? versionsHtml(p) : ""}
    </section>`;
  }

  function contractHtml(s, l) {
    const c = s.contract;
    if (!c || s.flow.listingId !== l.id) return "";
    const me = c.signatures.find((x) => x.who === "morador");
    return `<section class="block"><div class="block-head"><h3>Contrato</h3><span class="pill ${c.status === "ativo" ? "good" : "warn"}">${c.status === "ativo" ? "ativo" : "assinatura iniciada"}</span></div>
      <div class="row">${c.signatures.map((x) => `<span class="pill ${x.signed && x.valid ? "good" : x.signed ? "bad" : "dim"}">${x.who}: ${x.signed ? (x.valid ? "assinou" : "inválida") : "pendente"}</span>`).join("")}</div>
      ${c.status !== "ativo" && !(me.signed && me.valid) ? '<button class="btn primary" data-action="sign-morador">Assinar pelo provedor</button>' : ""}
      ${c.status === "ativo" ? `<div class="row"><button class="btn" data-action="inform-payment" ${s.payment !== "nenhum" ? "disabled" : ""}>Informar pagamento do 1º aluguel</button><span class="hint">Pagamento: ${esc(s.payment)}</span></div>` : ""}
    </section>`;
  }

  App.renderSheet = (s) => {
    const sheet = document.getElementById("sheet");
    const scrim = document.getElementById("scrim");
    const l = s.selectedId && App.listing(s, s.selectedId);
    if (!l) { sheet.hidden = true; if (document.getElementById("palette").hidden) scrim.hidden = true; return; }
    const keep = sheet.hidden ? 0 : sheet.scrollTop;
    const c = PT.monthlyCost(l);
    const addr = PT.visibleAddress(l, ME, s.visits);
    const exact = addr === l.endereco;
    const visit = App.myVisits(s).find((v) => v.listingId === l.id);
    sheet.innerHTML = `
      <div class="sheet-media">${Art.facade(l)}
        <button class="sheet-close" data-action="close-sheet" aria-label="Fechar">${ICON.close}</button>
        <div class="badges">${l.verificado ? `<span class="badge good">${ICON.seal}Verificado ${shortDate(l.verificado.data)} · ${esc(l.verificado.evidencia)}</span>` : '<span class="badge">Em verificação</span>'}</div>
      </div>
      <div class="sheet-body">
        <div><span class="eyebrow">${esc(l.tipo)} · Bairro ${l.bairro}</span><h2>${esc(l.titulo)}</h2>
          <div class="facts"><span>${l.area} m²</span><span>${l.quartos} quarto${l.quartos > 1 ? "s" : ""}</span>${l.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div></div>
        <div class="addr ${exact ? "open" : ""}"><b>${exact ? esc(addr) : "Bairro " + esc(addr) + " · endereço protegido"}</b><span>${exact ? "Endereço liberado pela visita confirmada." : "Endereço exato liberado após a visita confirmada."}</span></div>
        <section class="price-card">
          <div class="pc-top"><span class="eyebrow">Custo mensal estimado</span><b class="pc-total">${App.brl(c.total)}</b></div>
          <table class="cost-table"><tbody>${c.itens.map((it) => `<tr><td>${it.k}</td><td>${App.brl(it.v)}</td></tr>`).join("")}</tbody></table>
          ${costBar(l)}<p class="hint">Garantia e consumo (água, luz, gás) não estão incluídos e são informados à parte.</p>
        </section>
        <section class="block"><div class="block-head"><h3>Agendar visita</h3><span class="eyebrow">3 janelas por dia</span></div>
          ${slotsHtml(s, l)}
          ${visit ? `<div class="callout ${PT.isConfirmedVisit(visit) ? "good" : "warn"}"><b>${PT.isConfirmedVisit(visit) ? "Visita confirmada" : "Visita solicitada"}</b>${PT.isConfirmedVisit(visit) ? "Acesso confirmado pela equipe." : "Ainda não é confirmação: a equipe confirma o acesso com o responsável."}</div>`
            : `<button class="btn primary lg block" data-action="request-visit" data-id="${l.id}" ${s.pickedSlot ? "" : "disabled"}>${s.pickedSlot ? "Solicitar visita" : "Escolha um horário"}</button>`}
        </section>
        ${proposalHtml(s, l)}
        ${contractHtml(s, l)}
        <button class="btn ai-btn block" data-action="ask-copilot" data-q="Resuma os prós, contras e o custo total do imóvel ${esc(l.titulo)} (${l.id}) para um morador.">${ICON.spark}Perguntar ao copiloto sobre este imóvel</button>
      </div>`;
    sheet.hidden = false;
    scrim.hidden = false;
    sheet.scrollTop = keep;
  };

  App.actions["pick-slot"] = (el) => App.set({ pickedSlot: el.dataset.slot });

  App.actions["request-visit"] = (el) => {
    const s = App.state;
    const listingId = el.dataset.id;
    if (App.myVisits(s).some((v) => v.listingId === listingId)) return App.toast("Você já tem uma visita para este imóvel.", "warn");
    const visitId = App.uid("v");
    const r = PT.bookSlot(s.slots, s.pickedSlot, visitId);
    if (!r.ok) return App.toast(r.error, "bad");
    const visit = PT.requestVisit({ id: visitId, listingId, slotId: s.pickedSlot, account: ME.account });
    const l = App.listing(s, listingId);
    App.set((st) => ({ slots: r.slots, visits: [...st.visits, visit], pickedSlot: null, ...App.withAudit(st, "morador", `Visita solicitada · ${l.titulo}.`) }));
    App.toast("Visita solicitada. Ainda não é confirmação: a equipe confirma o acesso.", "warn");
  };

  App.actions["send-proposal"] = (el) => {
    const s = App.state;
    const id = el.dataset.id;
    const l = App.listing(s, id);
    if (!App.myVisits(s).some((v) => v.listingId === id && PT.isConfirmedVisit(v))) return App.toast("Confirme a visita antes de propor.", "warn");
    if (s.proposal && s.proposal.listingId !== id) return App.toast("Já existe uma proposta em andamento para " + App.listing(s, s.proposal.listingId).titulo + ".", "warn");
    const aluguel = Math.round(Number(document.getElementById("pAluguel").value));
    const prazoMeses = Math.round(Number(document.getElementById("pPrazo").value));
    if (!(aluguel >= 300 && aluguel <= 50000)) return App.toast("Informe um aluguel entre R$ 300 e R$ 50.000.", "bad");
    if (!(prazoMeses >= 12 && prazoMeses <= 60)) return App.toast("Informe um prazo entre 12 e 60 meses.", "bad");
    let proposal;
    let msg;
    if (!s.proposal) {
      proposal = { ...PT.createProposal({ id: App.uid("p"), aluguel, prazoMeses }), listingId: id };
      msg = "Proposta v1 enviada ao proprietário.";
    } else {
      proposal = PT.reviseProposal(s.proposal, { aluguel, prazoMeses }).proposal;
      const n = proposal.versions.length;
      msg = s.proposal.acceptedVersion !== null
        ? `Termos aceitos (v${s.proposal.acceptedVersion}) mantidos. v${n} registrada como contraproposta.`
        : `Proposta v${n} enviada.`;
    }
    App.set((st) => ({ proposal, flow: { ...st.flow, listingId: id }, ...App.withAudit(st, "morador", `Proposta v${proposal.versions.length} · ${l.titulo} · ${App.brl(aluguel)}.`) }));
    App.toast(msg, "good");
  };

  App.actions["sign-morador"] = () => {
    App.set((s) => ({ contract: PT.sign(s.contract, "morador", true), ...App.withAudit(s, "morador", "Assinatura do morador recebida do provedor.") }));
    App.toast("Assinatura registrada. O contrato só fica ativo com todas as assinaturas válidas.", "good");
  };

  App.actions["inform-payment"] = () => {
    App.set((s) => ({ payment: "informado", ...App.withAudit(s, "morador", "Pagamento informado pelo morador.") }));
    App.toast("Pagamento informado. Ainda não é recebimento conciliado.", "warn");
  };
})(typeof self !== "undefined" ? self : this);
