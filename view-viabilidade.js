/* Viabilidade: the study's models, live. Only P (IBGE) is fact; every other input is a hypothesis. */
(function (root) {
  "use strict";
  const { App, PT, PTData: D, Charts } = root;
  const esc = App.esc;
  const TAG = { f: '<span class="tag-fact">fato</span>', h: '<span class="tag-hyp">hipótese</span>', c: '<span class="tag-calc">cálculo</span>' };
  const CRIT = ["Demanda (D)", "Oferta (O)", "Execução (E)", "Margem (M)", "Concorrência (C)"];

  const pct = (v) => App.pct(v, v < 0.1 ? 1 : 0);
  const SLIDERS = {
    h: ["Pessoas por moradia (h)", 2, 4, 0.1, (v) => App.num(v, 1)],
    q: ["Moradias alugadas (q)", 0.1, 0.4, 0.01, pct],
    u: ["Giro anual (u)", 0.1, 0.35, 0.01, pct],
    c: ["Captação local (c)", 0.02, 0.15, 0.005, pct],
    gSC: ["Cobertura São Carlos (g)", 0.05, 0.6, 0.01, pct],
    gLD: ["Cobertura Londrina (g)", 0.05, 0.6, 0.01, pct],
    L: ["Aluguel médio (L)", 1000, 5000, 50, (v) => App.brl(v)],
    tau: ["Taxa de administração (τ)", 0.04, 0.15, 0.005, pct],
    v: ["Custo variável por contrato (v)", 20, 150, 5, (v) => App.brl(v)],
    F: ["Custo fixo mensal (F)", 10000, 60000, 500, (v) => App.brl(v)],
    d: ["Encerramentos ao mês (d)", 0, 0.05, 0.0025, (v) => App.pct(v, 2)],
    horizon: ["Horizonte (meses)", 12, 48, 1, (v) => v],
    dev: ["Desenvolvimento web (mês 1)", 20000, 35000, 1000, (v) => App.brl(v)],
    G: ["Gasto de aquisição da coorte (G)", 1000, 20000, 250, (v) => App.brl(v)],
    A: ["Ativações da coorte (A)", 1, 40, 1, (v) => v],
  };

  function slider(s, k, tag = "h") {
    const [label, min, max, step, fmt] = SLIDERS[k];
    return `<div class="field"><label for="sim-${k}"><span>${label} ${TAG[tag]}</span><output id="simv-${k}">${fmt(s.sim[k])}</output></label><input type="range" id="sim-${k}" min="${min}" max="${max}" step="${step}" value="${s.sim[k]}" data-input="sim" data-k="${k}"></div>`;
  }

  // ---------- Derived numbers ----------
  const terr = (s, id) => PT.territorial({ P: D.CITIES[id].P, h: s.sim.h, q: s.sim.q, u: s.sim.u, c: s.sim.c, g: App.cityG(s, id) });
  const econ = (s) => PT.unitEconomics({ L: s.sim.L, tau: s.sim.tau, v: s.sim.v });
  const nStar = (s) => PT.breakEven({ F: s.sim.F, m: econ(s).m });
  App.simSummary = (s) => {
    const e = econ(s);
    const n = nStar(s);
    return {
      cenario: App.city(s).nome, r: e.r, m: e.m, contratosEquilibrio: n,
      ativacoesMes: { saoCarlos: +terr(s, "sc").a.toFixed(2), londrina: +terr(s, "ld").a.toFixed(2) },
      mesesAteEquilibrio: n === null ? null : { saoCarlos: PT.monthsToTarget({ a: terr(s, "sc").a, d: s.sim.d, target: n }), londrina: PT.monthsToTarget({ a: terr(s, "ld").a, d: s.sim.d, target: n }) },
    };
  };

  // ---------- Praça ----------
  function pracaOut(s) {
    const id = s.city;
    const c = D.CITIES[id];
    const t = terr(s, id);
    const tSC = terr(s, "sc");
    const tLD = terr(s, "ld");
    const max = Math.max(tSC.a, tLD.a);
    const diff = tLD.a / tSC.a - 1;
    const node = (sym, val, small, tag) => `<div class="node"><span class="row" style="justify-content:space-between"><span class="sym">${sym}</span>${TAG[tag]}</span><span class="val">${val}</span><small>${small}</small></div>`;
    return `<div class="chain">
        ${node("P", App.num(c.P), "habitantes · IBGE 2026", "f")}
        ${node("H", App.num(t.H, 2), `P ÷ h · moradias`, "c")}
        ${node("R", App.num(t.R, 2), `q · H · estoque alugado`, "c")}
        ${node("V", App.num(t.V, 2), `u · R · oportunidades/ano`, "c")}
        ${node("a", App.num(t.a, 2), `g · c · V ÷ 12 · contratos/mês`, "c")}
      </div>
      <div class="stack" style="gap:8px">
        ${[["sc", tSC], ["ld", tLD]].map(([k, x]) => `<div class="funnel"><div class="bar"><span>${D.CITIES[k].nome}</span><div class="track"><div class="fill" style="width:${(x.a / max) * 100}%"></div></div><span class="mono" style="text-align:right">${App.num(x.a, 2)}</span></div></div>`).join("")}
        <div class="callout"><b>Londrina ${diff >= 0 ? "+" : ""}${App.pct(diff, 2)} em ativações por mês, com cobertura ${App.pct(s.sim.gLD)} contra ${App.pct(s.sim.gSC)}.</b>Uma área de atuação maior não exige a cidade toda. É um cenário condicional, não uma previsão: R é estoque, V é fluxo, a sazonalidade fica de fora.</div>
      </div>`;
  }

  function qOut(s) {
    const wsum = s.sim.w.reduce((a, b) => a + b, 0) || 1;
    const Q = (id) => s.sim.notas[id].reduce((acc, n, i) => acc + (s.sim.w[i] / wsum) * n, 0);
    return `<div class="row" style="gap:18px">${["sc", "ld"].map((id) => `<div class="stat"><span class="v">${App.num(Q(id), 2)}</span><span class="k">Q · ${D.CITIES[id].nome}</span></div>`).join("")}
      <span class="muted" style="font-size:var(--t-xs)">Pesos normalizados (Σw = 1), logo 0 ≤ Q ≤ 5. Pesquisa mínima: 100 anúncios por cidade; 15 proprietários, 15 moradores e 5 parceiros na finalista.</span></div>`;
  }

  function pracaView(s) {
    const id = s.city;
    const c = D.CITIES[id];
    return `<section class="panel stack" id="sec-praca" aria-labelledby="h-praca">
      <div class="panel-head" style="margin:0"><div><span class="eyebrow">Seleção de praça e modelo territorial · eq. (1)–(5)</span><h2 id="h-praca" style="margin-top:6px">Da população ao fluxo captável</h2></div>
        <span class="mono muted" style="font-size:var(--t-xs)">${esc(c.nome)} · IBGE ${c.ibge} · Censo 2022: ${App.num(c.censo)}</span></div>
      <div class="grid cols-3">${slider(s, "h")}${slider(s, "q")}${slider(s, "u")}${slider(s, "c")}${slider(s, "gSC")}${slider(s, "gLD")}</div>
      <div id="praca-out" class="stack">${pracaOut(s)}</div>
      <hr class="rule">
      <div class="panel-head" style="margin:0"><h3>Índice de praça · Q = Σ wₖ · notaₖ</h3><span class="eyebrow">notas de 0 a 5 · ${esc(c.nome)}</span></div>
      <div class="q-grid">${CRIT.map((k, i) => `<div class="stack" style="gap:8px">
        <div class="field"><label for="nota-${i}">${k} <output id="notav-${i}">${App.num(s.sim.notas[id][i], 1)}</output></label><input type="range" id="nota-${i}" min="0" max="5" step="0.5" value="${s.sim.notas[id][i]}" data-input="sim-nota" data-i="${i}"></div>
        <div class="field"><label for="w-${i}">Peso <output id="wv-${i}">${App.num(s.sim.w[i], 2)}</output></label><input type="range" id="w-${i}" min="0" max="0.5" step="0.05" value="${s.sim.w[i]}" data-input="sim-w" data-i="${i}"></div></div>`).join("")}</div>
      <div id="q-out">${qOut(s)}</div>
    </section>`;
  }

  // ---------- Radar de bairros (deck section 07): value printed in each cell, color reinforces ----------
  function radarView(s) {
    const data = D.BAIRRO_RADAR[s.city];
    const cells = D.RADAR_METRICS.map((m) => {
      const vals = D.BAIRROS.map((b) => data[b.id][m.k]);
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      return { m, score: (v) => { const t = hi === lo ? 0.5 : (v - lo) / (hi - lo); return m.good === "high" ? t : 1 - t; } };
    });
    const fmt = (m, v) => (m.u === "%" ? App.num(v, 1) + "%" : App.num(v) + m.u);
    return `<section class="panel stack" id="sec-radar" aria-labelledby="h-rad">
      <div class="panel-head"><div><span class="eyebrow">Radar de bairros · ${esc(App.city(s).nome)}</span><h2 id="h-rad">Quatro métricas, quatro bairros</h2></div><span class="eyebrow">valores fictícios</span></div>
      <div class="table-wrap"><table class="heat"><thead><tr><th>Bairro</th>${cells.map((c) => `<th>${c.m.t}</th>`).join("")}</tr></thead><tbody>
        ${D.BAIRROS.map((b) => `<tr><td><b>${b.nome}</b><br><small class="muted">fase ${b.fase}</small></td>${cells.map((c) => {
          const v = data[b.id][c.m.k];
          const sc = c.score(v);
          return `<td class="hc" style="--h:${Math.round(sc * 100)}"><span>${fmt(c.m, v)}</span></td>`;
        }).join("")}</tr>`).join("")}
      </tbody></table></div>
      <div class="row"><span class="legend-inline"><span><i class="hl-bad"></i>pior entre os bairros</span><span><i class="hl-good"></i>melhor</span></span>
        <span class="hint">Tendência importa mais que nível. Vacância e oferta nova antecipam pressão sobre aluguel; days-on-market mede liquidez.</span></div>
    </section>`;
  }

  // ---------- Carteira ----------
  function carteiraOut(s) {
    const { r, m } = econ(s);
    const F = s.sim.F;
    const n = nStar(s);
    if (n === null) {
      return `<div class="stat-row"><div class="stat"><span class="v">${App.brl(r)}</span><span class="k">receita por contrato · r = τ · L</span></div><div class="stat"><span class="v" style="color:var(--bad)">${App.brl(m)}</span><span class="k">contribuição · m = r − v</span></div></div>
        <div class="callout bad"><b>Com m ≤ 0 e F > 0, nenhuma carteira equilibra.</b>Reveja taxa, aluguel médio ou custo variável.</div>`;
    }
    const p = { L: s.sim.L, tau: s.sim.tau, v: s.sim.v, F };
    const rows = [Math.max(0, n - 1), n, Math.max(200, n + 50)];
    const nMax = Math.max(300, Math.ceil(n * 1.6 / 50) * 50);
    const chart = Charts.line({
      w: 640, h: 230, xMax: nMax, yMin: -F, title: "Saldo operacional por número de contratos",
      series: [{ points: [[0, -F], [nMax, nMax * m - F]], cls: "a" }],
      marks: [{ x: n, y: n * m - F, cls: "c", label: `N* = ${n}` }],
      xFmt: (x) => App.num(x), yFmt: (y) => App.num(y / 1000, 0) + "k",
    });
    return `<div class="stat-row">
        <div class="stat"><span class="v">${App.brl(r)}</span><span class="k">receita/contrato · r = τ · L</span></div>
        <div class="stat"><span class="v">${App.brl(m)}</span><span class="k">contribuição · m = r − v</span></div>
        <div class="stat"><span class="v big" style="color:var(--cyan)">${n}</span><span class="k">contratos ativos para equilibrar</span></div>
      </div>
      <div class="formula">N* = ⌈F ÷ m⌉ = ⌈${App.num(F)} ÷ ${App.num(m, 2)}⌉ = ⌈${App.num(F / m, 2)}⌉ = <b>${n}</b> · arredonda para cima porque a carteira tem contratos inteiros</div>
      ${chart}
      <div class="table-wrap"><table><thead><tr><th>Carteira</th><th class="r">Receita</th><th class="r">Custo</th><th class="r">Saldo</th><th></th></tr></thead><tbody>
        ${rows.map((N) => { const x = PT.portfolioAt(N, p); return `<tr><td class="mono">${N} contratos</td><td class="r mono">${App.num(x.receita)}</td><td class="r mono">${App.num(x.custo)}</td><td class="r mono" style="color:${x.saldo >= 0 ? "var(--good)" : "var(--bad)"}">${x.saldo >= 0 ? "+" : ""}${App.num(x.saldo)}</td><td>${x.saldo >= 0 ? '<span class="pill good">cobre</span>' : '<span class="pill bad">déficit</span>'}</td></tr>`; }).join("")}
      </tbody></table></div>`;
  }

  function sensOut(s) {
    const { L, tau, v, F } = s.sim;
    const be = (t, vv, ff) => PT.breakEven({ F: ff, m: PT.unitEconomics({ L, tau: t, v: vv }).m });
    const t2 = Math.max(0.01, +(tau - 0.02).toFixed(4));
    const shocks = [
      ["Base", be(tau, v, F)],
      [`Taxa ${App.pct(tau, 1)} → ${App.pct(t2, 1)}`, be(t2, v, F)],
      [`Variável ${App.brl(v)} → ${App.brl(v + 30)}`, be(tau, v + 30, F)],
      [`Fixo ${App.mil(F)} → ${App.mil(F + 5000)}`, be(tau, v, F + 5000)],
      [`Taxa −2 p.p. e variável +R$ 30`, be(t2, v + 30, F)],
    ];
    const max = Math.max(...shocks.map((x) => x[1] || 0), 1);
    return `<div class="funnel">${shocks.map(([k, n], i) => `<div class="bar" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) 64px"><span style="font-size:var(--t-xs)">${esc(k)}</span><div class="track"><div class="fill" style="width:${n ? (n / max) * 100 : 100}%;${i ? "" : "background:var(--muted)"}${n === null ? ";background:var(--bad)" : ""}"></div></div><span class="mono" style="text-align:right">${n === null ? "∞" : n}</span></div>`).join("")}</div>
      <div class="callout warn"><b>Desconto amplo pode trazer aquisição e, ao mesmo tempo, exigir carteira maior.</b>Mais aluguel ou mais taxa elevam a contribuição, se o mercado e o escopo aceitarem.</div>`;
  }

  function carteiraView(s) {
    return `<section class="panel stack" id="sec-carteira" aria-labelledby="h-cart">
      <div class="panel-head" style="margin:0"><div><span class="eyebrow">Economia da carteira · eq. (12)–(16)</span><h2 id="h-cart" style="margin-top:6px">Contribuição paga a estrutura</h2></div><span class="eyebrow">a taxa é receita própria; o aluguel do proprietário fica segregado</span></div>
      <div class="grid cols-2">${slider(s, "L")}${slider(s, "tau")}${slider(s, "v")}${slider(s, "F")}</div>
      <div class="split"><div id="carteira-out" class="stack">${carteiraOut(s)}</div>
        <div class="stack"><h3>Sensibilidade</h3><div id="sens-out" class="stack">${sensOut(s)}</div></div></div>
    </section>`;
  }

  // ---------- Crescimento ----------
  function growthOut(s) {
    const n = nStar(s);
    const H = s.sim.horizon;
    const sc = PT.growth({ a: terr(s, "sc").a, d: s.sim.d, months: H });
    const ld = PT.growth({ a: terr(s, "ld").a, d: s.sim.d, months: H });
    const mSC = n === null ? null : PT.monthsToTarget({ a: terr(s, "sc").a, d: s.sim.d, target: n });
    const mLD = n === null ? null : PT.monthsToTarget({ a: terr(s, "ld").a, d: s.sim.d, target: n });
    const marks = [];
    if (mSC && mSC <= H) marks.push({ x: mSC, y: sc[mSC], cls: "a", label: `São Carlos · mês ${mSC}` });
    if (mLD && mLD <= H) marks.push({ x: mLD, y: ld[mLD], cls: "b", label: `Londrina · mês ${mLD}` });
    const yMax = Charts.niceMax(Math.max(sc[H], ld[H], n || 0) * 1.1);
    const chart = Charts.line({
      w: 640, h: 260, xMax: H, yMax, title: "Carteira ativa por mês",
      series: [{ points: sc.map((y, x) => [x, y]), cls: "a", area: true }, { points: ld.map((y, x) => [x, y]), cls: "b" }],
      hlines: n === null ? [] : [{ y: n, cls: "target", label: `equilíbrio · ${n} contratos` }], marks,
      xFmt: (x) => "m" + x, yFmt: (y) => App.num(y),
    });
    const fmtM = (m) => (m === null ? "não alcança" : `mês ${m}`);
    return `<div class="stat-row"><div class="stat"><span class="v" style="color:var(--accent)">${fmtM(mSC)}</span><span class="k">São Carlos · ${App.num(terr(s, "sc").a, 2)} ativações/mês</span></div>
        <div class="stat"><span class="v" style="color:var(--amber)">${fmtM(mLD)}</span><span class="k">Londrina · ${App.num(terr(s, "ld").a, 2)} ativações/mês</span></div></div>
      ${chart}
      <div class="callout warn"><b>A oferta precisa ser renovada.</b>Os 30 a 50 anúncios iniciais validam a jornada; não sustentam ${n === null ? "a carteira" : n + " contratos ativos"}. Valor esperado, cenário determinístico.</div>`;
  }

  function growthView(s) {
    return `<section class="panel stack" id="sec-crescimento" aria-labelledby="h-gr">
      <div class="panel-head" style="margin:0"><div><span class="eyebrow">Crescimento modelado · eq. (17)</span><h2 id="h-gr" style="margin-top:6px">Da ativação à carteira recorrente</h2></div><span class="formula" style="padding:6px 10px">Nₜ = (1 − d) · Nₜ₋₁ + a</span></div>
      <div class="grid cols-2">${slider(s, "d")}${slider(s, "horizon", "c")}</div>
      <div id="growth-out" class="stack">${growthOut(s)}</div>
    </section>`;
  }

  // ---------- Orçamento e caixa ----------
  function caixaOut(s) {
    const all = [...PT.BUDGET_B, ...PT.BUDGET_A];
    const tot = PT.sumRange(all);
    const tb = PT.sumRange(PT.BUDGET_B);
    const ta = PT.sumRange(PT.BUDGET_A);
    const gross = PT.grossOutlay({ monthly: tot, months: 6, dev: { min: 20000, max: 35000 } });
    const maxLine = Math.max(...all.map((l) => l.max));
    const bars = (lines, cls) => lines.map((l) => `<div class="rb"><span>${esc(l.item)}</span><div class="tr"><i class="${cls}" style="left:${(l.min / maxLine) * 100}%;right:${100 - (l.max / maxLine) * 100}%"></i></div><span class="mono" style="text-align:right;font-size:var(--t-xs)">${App.num(l.min)}–${App.num(l.max)}</span></div>`).join("");
    const { r, v } = { r: econ(s).r, v: s.sim.v };
    const fixed = s.sim.budget === "max" ? tot.max : tot.min;
    const H = s.sim.horizon;
    const N = PT.growth({ a: terr(s, s.city).a, d: s.sim.d, months: H });
    const net = N.slice(1).map((n, i) => n * r - (fixed + n * v) - (i === 0 ? s.sim.dev : 0));
    let cum = 0;
    const cumPts = [[0, 0], ...net.map((f, i) => { cum += f; return [i + 1, cum]; })];
    const K = PT.capitalNeed(net);
    const low = cumPts.reduce((a, b) => (b[1] < a[1] ? b : a), cumPts[0]);
    const turn = net.findIndex((f) => f >= 0);
    const chart = Charts.line({
      w: 640, h: 240, xMax: H, yMin: low[1], title: "Caixa acumulado",
      series: [{ points: cumPts, cls: "c", area: true }],
      marks: [{ x: low[0], y: low[1], cls: "b", label: `aporte mínimo ${App.mil(Math.round(K / 100) * 100)}` }],
      xFmt: (x) => "m" + x, yFmt: (y) => App.num(y / 1000, 0) + "k",
    });
    const cac = s.sim.G / s.sim.A;
    const m = econ(s).m;
    return `<div class="split">
      <div class="stack"><div class="row" style="justify-content:space-between"><h3>Orçamento mensal consolidado</h3><span class="mono">${App.num(tot.min)}–${App.num(tot.max)}</span></div>
        <div class="range-bars"><span class="eyebrow">B · plano original · ${App.num(tb.min)}–${App.num(tb.max)}</span>${bars(PT.BUDGET_B, "b")}<span class="eyebrow" style="margin-top:6px">A · complementação gerencial · ${App.num(ta.min)}–${App.num(ta.max)}</span>${bars(PT.BUDGET_A, "a")}</div>
        <div class="callout"><b>Total parcial C = B + A · soma exata.</b>Ainda apurar: tributos, comissões, tarifas variáveis, serviços, crédito, seguros e estrutura física.</div>
        <div class="stat-row"><div class="stat"><span class="v">${App.mil(gross.min)}–${App.mil(gross.max)}</span><span class="k">desembolso bruto · 6 meses + desenvolvimento</span></div></div>
      </div>
      <div class="stack"><div class="row" style="justify-content:space-between"><h3>Caixa · ${esc(App.city(s).nome)}</h3>
          <div class="seg" role="group" aria-label="Orçamento"><button data-action="budget-mode" data-mode="min" aria-pressed="${s.sim.budget === "min"}">Piso</button><button data-action="budget-mode" data-mode="max" aria-pressed="${s.sim.budget === "max"}">Teto</button></div></div>
        ${chart}
        <div class="stat-row"><div class="stat"><span class="v" style="color:var(--amber)">${App.brl(Math.round(K))}</span><span class="k">aporte mínimo · K = máx(0, −mín Σ(I − O))</span></div>
          <div class="stat"><span class="v">${turn < 0 ? "após m" + H : "m" + (turn + 1)}</span><span class="k">primeiro mês com saldo positivo</span></div></div>
        <small class="muted">Custo fixo = orçamento mensal (${s.sim.budget === "max" ? "teto" : "piso"}); desenvolvimento no mês 1; caixa inicial zero. Receitas de setup e despesas não apuradas ficam fora. Seis meses não demonstram caixa até o equilíbrio.</small>
        <hr class="rule"><h3>Aquisição e conversão</h3>
        <div class="grid cols-2">${slider(s, "G")}${slider(s, "A")}</div>
        <div class="formula">CAC = G ÷ A = <b>${App.brl(cac)}</b> · retorno = CAC ÷ m ≈ <b>${m > 0 ? App.num(cac / m, 1) + " meses" : "sem retorno"}</b></div>
        <small class="muted">Mídia cresce com oferta e capacidade, não só com custo por lead menor.</small>
      </div></div>`;
  }

  function caixaView(s) {
    return `<section class="panel stack" id="sec-caixa" aria-labelledby="h-cx">
      <div class="panel-head" style="margin:0"><div><span class="eyebrow">Orçamento, caixa e capital · eq. (19)–(23)</span><h2 id="h-cx" style="margin-top:6px">Desembolso bruto e aporte</h2></div><span class="pill warn">orçamento parcial</span></div>
      ${slider(s, "dev")}
      <div id="caixa-out">${caixaOut(s)}</div>
    </section>`;
  }

  // ---------- Execução, riscos e fontes ----------
  function execView() {
    const weeks = Array.from({ length: 14 }, (_, i) => i + 1);
    return `<section class="panel stack" id="sec-execucao" aria-labelledby="h-ex">
      <div class="panel-head" style="margin:0"><div><span class="eyebrow">Execução · cronograma proposto</span><h2 id="h-ex" style="margin-top:6px">Quatorze semanas até um piloto real</h2></div><span class="eyebrow">■ porta de passagem</span></div>
      <div class="table-wrap"><div class="gantt">
        <div class="gr"><span></span>${weeks.map((w) => `<span class="wk">${w}</span>`).join("")}</div>
        ${D.ROADMAP.map((r) => `<div class="gr"><span><b>${esc(r.trilha)}</b><br><small class="muted">${esc(r.entrega)}</small></span>${weeks.map((w) => `<span class="cell ${w >= r.ini && w <= r.fim ? "on" : ""} ${w === r.fim ? "gate" : ""}" title="${w === r.fim ? "Porta: " + esc(r.porta) : ""}"></span>`).join("")}</div>`).join("")}
      </div></div>
      <div class="grid cols-2"><div class="callout good"><b>Expandir com</b>contribuição positiva, aquisição sustentável, repasses conciliados e capacidade.</div>
        <div class="callout warn"><b>Conversão baixa</b>corrigir preço, oferta ou jornada antes de ampliar mídia.</div></div>
    </section>`;
  }

  function riscoView() {
    return `<section class="panel stack" id="sec-riscos" aria-labelledby="h-rk">
      <div class="panel-head" style="margin:0"><div><span class="eyebrow">Risco e contratação</span><h2 id="h-rk" style="margin-top:6px">Resolver o risco na origem</h2></div></div>
      <div class="table-wrap"><table><thead><tr><th>Risco</th><th>Prevenção e resposta</th><th>Responsável</th></tr></thead><tbody>
        ${D.RISKS.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td class="muted">${esc(r[2])}</td></tr>`).join("")}</tbody></table></div>
      <div class="grid cols-3">
        <div class="callout"><b>Lei 6.530/1978 · corretagem</b>Separar quem desenvolve o software de quem intermedeia; validar no CRECI.</div>
        <div class="callout"><b>Lei 8.245/1991 · art. 37</b>Veda mais de uma modalidade de garantia no mesmo contrato.</div>
        <div class="callout"><b>LGPD · art. 20</b>IA em rascunhos e resumos; revisão humana nas decisões relevantes.</div>
      </div>
      <small class="muted">Fontes: F1–F2 IBGE, estimativas 2026 e Censo 2022 de São Carlos (SP) e Londrina (PR); F3 Lei 6.530/1978; F4 Lei 8.245/1991; F5 Lei 13.709/2018; F6 ANPD, guia de segurança para agentes de pequeno porte. Requer revisão jurídica específica. Base: estudo integrado “PropTech — Do bairro à carteira”, Jose Edson Matos da Costa, 15 out 2026.</small>
    </section>`;
  }

  App.views.viabilidade = {
    render(s) {
      const chips = [["sec-praca", "Praça"], ["sec-radar", "Radar de bairros"], ["sec-carteira", "Carteira"], ["sec-crescimento", "Crescimento"], ["sec-caixa", "Orçamento e caixa"], ["sec-execucao", "Execução"], ["sec-riscos", "Riscos e fontes"]];
      return `<div class="view">
        <div class="view-head"><div><span class="eyebrow">Viabilidade · cenário ${esc(App.city(s).nome)}</span>
          <h1>Validar o ciclo completo antes da expansão.</h1>
          <p class="lede">Mexa nas premissas e veja a consequência. Só a população vem de fonte oficial; o resto são hipóteses a substituir por pesquisa local, cotação e contratos reais.</p></div>
          <div class="row">${TAG.f}${TAG.h}${TAG.c}<button class="btn small ai-btn" data-action="ask-copilot" data-q="Explique, em linguagem simples, o cenário atual de viabilidade e o que mais pesa no equilíbrio."><svg class="spark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7Z"/></svg>Explicar com IA</button></div></div>
        <nav class="subnav" aria-label="Seções">${chips.map(([id, t]) => `<button class="chip" data-action="scroll-to" data-target="${id}">${t}</button>`).join("")}</nav>
        ${pracaView(s)}${radarView(s)}${carteiraView(s)}${growthView(s)}${caixaView(s)}${execView()}${riscoView()}
      </div>`;
    },
  };

  function refresh() {
    const s = App.state;
    const put = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    put("praca-out", pracaOut(s));
    put("q-out", qOut(s));
    put("carteira-out", carteiraOut(s));
    put("sens-out", sensOut(s));
    put("growth-out", growthOut(s));
    put("caixa-out", caixaOut(s));
  }

  App.inputs.sim = (el) => {
    const k = el.dataset.k;
    const v = Number(el.value);
    App.set((s) => ({ sim: { ...s.sim, [k]: v } }), { render: false });
    const o = document.getElementById("simv-" + k);
    if (o) o.textContent = SLIDERS[k][4](v);
    refresh();
  };
  App.inputs["sim-nota"] = (el) => {
    const i = Number(el.dataset.i);
    const v = Number(el.value);
    App.set((s) => ({ sim: { ...s.sim, notas: { ...s.sim.notas, [s.city]: s.sim.notas[s.city].map((x, j) => (j === i ? v : x)) } } }), { render: false });
    document.getElementById("notav-" + i).textContent = App.num(v, 1);
    refresh();
  };
  App.inputs["sim-w"] = (el) => {
    const i = Number(el.dataset.i);
    const v = Number(el.value);
    App.set((s) => ({ sim: { ...s.sim, w: s.sim.w.map((x, j) => (j === i ? v : x)) } }), { render: false });
    document.getElementById("wv-" + i).textContent = App.num(v, 2);
    refresh();
  };
  App.actions["budget-mode"] = (el) => { App.set((s) => ({ sim: { ...s.sim, budget: el.dataset.mode } }), { render: false }); refresh(); };
  App.actions["scroll-to"] = (el) => { const t = document.getElementById(el.dataset.target); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); };

  App.SIM_LIMITS = Object.fromEntries(Object.entries(SLIDERS).map(([k, x]) => [k, [x[1], x[2]]]));
})(typeof self !== "undefined" ? self : this);
