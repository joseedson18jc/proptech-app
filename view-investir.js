/* Investir: from the neighborhood to the portfolio. Selic vs FII yield, illustrative profiles,
   compound simulator, fictional FII scatter and a scored due-diligence checklist.
   Educational only: nothing here is a recommendation, and nothing touches contracts or listings. */
(function (root) {
  "use strict";
  const { App, PT, PTData: D, Charts } = root;
  const esc = App.esc;
  const HYP = '<span class="tag-hyp">hipótese</span>';
  const SEG = { tijolo: "Tijolo", papel: "Papel", fof: "Fundo de fundos", desenvolvimento: "Desenvolvimento" };

  const money = App.money;

  const pctA = (v) => App.num(v * 100, 1) + "%";
  const SL = {
    selic: ["Selic / CDI (a.a.)", 2, 16, 0.25, (v) => App.num(v, 2) + "%"],
    yieldFII: ["Yield do FII (a.a.)", 4, 16, 0.1, (v) => App.num(v, 1) + "%"],
    inicial: ["Aporte inicial", 0, 200000, 1000, (v) => money(v)],
    mensal: ["Aporte mensal", 0, 10000, 100, (v) => App.brl(v)],
    yieldAA: ["Yield anual reinvestido", 0.04, 0.16, 0.0025, pctA],
    valAA: ["Valorização anual das cotas", 0, 0.06, 0.0025, pctA],
    anos: ["Horizonte (anos)", 1, 40, 1, (v) => v + " anos"],
  };
  const slider = (s, k) => {
    const [label, min, max, step, fmt] = SL[k];
    return `<div class="field"><label for="inv-${k}"><span>${label} ${HYP}</span><output id="invv-${k}">${fmt(s.inv[k])}</output></label><input type="range" id="inv-${k}" min="${min}" max="${max}" step="${step}" value="${s.inv[k]}" data-input="inv" data-k="${k}"></div>`;
  };

  // ---------- Selic vs FII ----------
  function selicOut(s) {
    const { selic, yieldFII } = s.inv;
    const sp = PT.fiiSpread({ yieldFII, selic });
    const max = Math.max(selic, yieldFII, 1);
    const bar = (k, v, cls) => `<div class="bar"><span>${k}</span><div class="track"><div class="fill ${cls}" style="width:${(v / max) * 100}%"></div></div><span class="mono" style="text-align:right">${App.num(v, 2)}%</span></div>`;
    const sign = (v) => (v >= 0 ? "+" : "−") + App.num(Math.abs(v), 2) + " p.p.";
    const verdict = sp.liquido >= 0
      ? `<div class="callout good"><b>O yield do FII supera o CDI líquido em ${sign(sp.liquido)}.</b>A renda isenta compensa o risco extra só se o fundo atender aos requisitos e a tese sobreviver sem o subsídio.</div>`
      : `<div class="callout warn"><b>O CDI líquido paga mais: ${sign(sp.liquido)} para o FII.</b>Com juro alto, o FII compete com a renda fixa e perde; para horizonte longo, pode ser janela de desconto.</div>`;
    return `<div class="stat-row">
        <div class="stat"><span class="v" style="color:${sp.bruto >= 0 ? "var(--good)" : "var(--bad)"}">${sign(sp.bruto)}</span><span class="k">spread contra o CDI bruto</span></div>
        <div class="stat"><span class="v">${App.num(sp.cdiLiquido, 2)}%</span><span class="k">CDI líquido · CDB com IR de 15% (prazo > 720 dias)</span></div>
        <div class="stat"><span class="v" style="color:${sp.liquido >= 0 ? "var(--good)" : "var(--bad)"}">${sign(sp.liquido)}</span><span class="k">spread contra o CDI líquido</span></div>
      </div>
      <div class="funnel">${bar("Yield do FII", yieldFII, "")}${bar("CDI bruto", selic, "f-peach")}${bar("CDI líquido", sp.cdiLiquido, "f-teal")}</div>
      ${verdict}`;
  }

  // ---------- Profiles ----------
  function radarSvg(p) {
    const cx = 160, cy = 150, R = 105;
    const pt = (i, r) => {
      const a = (-90 + i * 72) * Math.PI / 180;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    };
    const ring = (lv) => D.EIXOS.map((_, i) => pt(i, (R * lv) / 5).join(",")).join(" ");
    const shape = (vals) => vals.map((v, i) => pt(i, (R * v) / 5).join(",")).join(" ");
    const others = Object.entries(D.PROFILES).filter(([, x]) => x !== p).map(([, x]) => `<polygon class="rd-other" points="${shape(x.eixos)}"/>`).join("");
    const labels = D.EIXOS.map((t, i) => { const [x, y] = pt(i, R + 22); return `<text class="rd-lbl" x="${x}" y="${y + 4}" text-anchor="middle">${t}</text>`; }).join("");
    return `<svg class="radar" viewBox="0 0 320 300" role="img" aria-label="Perfil ${esc(p.nome)} em cinco eixos">
      ${[1, 2, 3, 4, 5].map((lv) => `<polygon class="rd-grid" points="${ring(lv)}"/>`).join("")}
      ${D.EIXOS.map((_, i) => { const [x, y] = pt(i, R); return `<line class="rd-grid" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`; }).join("")}
      ${others}<polygon class="rd-main" points="${shape(p.eixos)}"/>
      ${p.eixos.map((v, i) => { const [x, y] = pt(i, (R * v) / 5); return `<circle class="rd-dot" cx="${x}" cy="${y}" r="4"/>`; }).join("")}
      ${labels}</svg>`;
  }
  const ALLOC_CLS = { Papel: "a-papel", Tijolo: "a-tijolo", "Fundo de fundos": "a-fof", Desenvolvimento: "a-dev" };
  function profileOut(s) {
    const p = D.PROFILES[s.inv.perfil] || D.PROFILES.moderado;
    const entries = Object.entries(p.alloc);
    return `<div class="split" style="align-items:center">${radarSvg(p)}
      <div class="stack"><div><span class="eyebrow">${esc(p.nome)}</span><h3>${esc(p.resumo)}</h3></div>
        <div class="alloc" aria-hidden="true">${entries.map(([k, v]) => `<i class="${ALLOC_CLS[k]}" style="width:${v}%"></i>`).join("")}</div>
        <div class="alloc-list">${entries.map(([k, v]) => `<div><span><i class="${ALLOC_CLS[k]}"></i>${k}</span><b class="mono">${v}%</b></div>`).join("")}</div>
        <p class="hint">Perfis e alocações ilustrativos para comparar regimes de risco. Não é recomendação nem análise de perfil.</p></div></div>`;
  }

  // ---------- Simulator ----------
  function simOut(s) {
    const i = s.inv;
    const r = PT.compound(i);
    const chart = Charts.line({
      w: 640, h: 250, xMax: i.anos, title: "Evolução do patrimônio",
      series: [{ points: r.serie.map((y, x) => [x, y]), cls: "a", area: true }, { points: r.serie.map((_, x) => [x, i.inicial + i.mensal * 12 * x]), cls: "b" }],
      marks: [{ x: i.anos, y: r.final, cls: "a", label: money(r.final) }],
      xFmt: (x) => x + "a", yFmt: (y) => (y >= 1e6 ? App.num(y / 1e6, 1) + " mi" : App.num(y / 1e3, 0) + "k"),
    });
    return `<div class="stat-row">
        <div class="stat" style="grid-column:1/-1"><span class="v big" style="color:var(--accent)">${money(r.final)}</span><span class="k">patrimônio final em ${i.anos} anos</span></div>
        <div class="stat"><span class="v">${App.brl(r.rendaMensal)}</span><span class="k">renda mensal gerada</span></div>
        <div class="stat"><span class="v">${money(r.aportado)}</span><span class="k">total aportado</span></div>
        <div class="stat"><span class="v" style="color:var(--good)">${money(r.juros)}</span><span class="k">juros + valorização</span></div>
      </div>
      ${chart}
      <div class="legend-inline"><span><i class="c-aluguel"></i>patrimônio</span><span><i style="background:var(--peach)"></i>total aportado</span></div>
      <p class="hint">Simulação didática e ilustrativa: aportes no fim do mês, rendimento reinvestido, sem inflação, IR ou custos. Não é recomendação nem promessa de retorno.</p>`;
  }

  // ---------- Scatter ----------
  function scatterOut(s) {
    const W = 640, H = 300, pad = { l: 48, r: 18, t: 16, b: 34 };
    const X = (v) => pad.l + ((v - 0.6) / 0.7) * (W - pad.l - pad.r);
    const Y = (v) => pad.t + (1 - (v - 5) / 10) * (H - pad.t - pad.b);
    const cdiL = PT.fiiSpread({ yieldFII: 0, selic: s.inv.selic }).cdiLiquido;
    let g = "";
    for (let v = 6; v <= 15; v += 3) g += `<line class="grid-l" x1="${pad.l}" x2="${W - pad.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axis-t" x="${pad.l - 8}" y="${Y(v) + 3}" text-anchor="end">${v}%</text>`;
    for (let v = 0.6; v <= 1.31; v += 0.1) g += `<text class="axis-t" x="${X(v)}" y="${H - 12}" text-anchor="middle">${App.num(v, 1)}</text>`;
    const cdiLine = cdiL >= 5 && cdiL <= 15 ? `<line class="target" x1="${pad.l}" x2="${W - pad.r}" y1="${Y(cdiL)}" y2="${Y(cdiL)}"/><text class="lbl-good" x="${W - pad.r - 4}" y="${Y(cdiL) - 6}" text-anchor="end">CDI líquido ${App.num(cdiL, 1)}%</text>` : "";
    const pts = D.FIIS.map((f, i) => `<circle class="sc-pt sc-${f.seg} ${s.fiiSel === i ? "on" : ""}" cx="${X(f.pvp)}" cy="${Y(f.dy)}" r="${s.fiiSel === i ? 9 : 7}" data-action="fii" data-i="${i}" tabindex="0" role="button" aria-label="${esc(f.nome)}: P/VP ${App.num(f.pvp, 2)}, DY ${App.num(f.dy, 1)}%"><title>${esc(f.nome)} · ${SEG[f.seg]}</title></circle>`).join("");
    const sel = D.FIIS[s.fiiSel];
    const info = sel
      ? `<b>${esc(sel.nome)} (fictício) · ${SEG[sel.seg]}</b>P/VP ${App.num(sel.pvp, 2)} · dividend yield ${App.num(sel.dy, 1)}% · ${sel.pvp < 1 && sel.dy > cdiL ? "desconto com renda: investigar por quê." : sel.pvp > 1 ? "prêmio: a tese precisa ser de crescimento." : sel.dy < cdiL ? "abaixo do CDI líquido: compete com a renda fixa e perde." : "perto do valor patrimonial."}`
      : "<b>Toque num ponto</b>para ler o fundo. Superior esquerdo: desconto com renda. Direita: prêmio. Abaixo da linha: perde para o CDI líquido.";
    return `<svg class="chart scatter" viewBox="0 0 ${W} ${H}" role="img" aria-label="P/VP por dividend yield de fundos fictícios">
        ${g}<line class="zero" x1="${X(1)}" x2="${X(1)}" y1="${pad.t}" y2="${H - pad.b}"/><text class="axis-t" x="${X(1) + 4}" y="${pad.t + 10}">P/VP = 1</text>${cdiLine}${pts}</svg>
      <div class="legend-inline">${Object.entries(SEG).map(([k, t]) => `<span><i class="sc-${k}"></i>${t}</span>`).join("")}</div>
      <div class="callout" id="fiiInfo">${info}</div>`;
  }

  // ---------- Checklist ----------
  function scoreOut(s) {
    const all = D.CHECKLIST.map((c) => c.id);
    const n = PT.checklistScore(s.inv.checklist, all);
    const C = 2 * Math.PI * 34;
    const msg = n === 0 ? "Comece a marcar" : n < 5 ? "Ritual inicial" : n < 8 ? "Análise consistente" : n < 10 ? "Diligência madura" : "Checklist completo";
    return `<svg class="ring" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="34" class="ring-bg"/><circle cx="42" cy="42" r="34" class="ring-fg" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - n / all.length)}"/></svg>
      <div><b class="score">${n}/${all.length}</b><span class="eyebrow">${msg}</span></div>`;
  }

  App.views.investir = {
    render(s) {
      const groups = [...new Set(D.CHECKLIST.map((c) => c.g))];
      return `<div class="view">
        <div class="view-head"><div><span class="eyebrow">Investir · do bairro à carteira</span>
          <h1>O bairro lido como dado, levado à carteira.</h1>
          <p class="lede">Compare o yield de fundos imobiliários com o CDI, explore perfis e simule a renda composta. Fundos e números são fictícios.</p></div>
          <span class="pill warn">ilustrativo · não é recomendação</span></div>

        <div class="grid cols-2">
          <section class="panel stack" aria-labelledby="h-selic">
            <div class="panel-head"><div><span class="eyebrow">Juros e ciclo</span><h2 id="h-selic">A Selic é o vento contrário</h2></div></div>
            <div class="grid cols-2">${slider(s, "selic")}${slider(s, "yieldFII")}</div>
            <div id="selic-out" class="stack">${selicOut(s)}</div>
            <p class="hint">Isenção de IR para pessoa física vale quando o fundo atende aos requisitos (100+ cotistas, negociação em bolsa e cotista com menos de 10% das cotas) e a regra pode mudar. Valores de Selic e yield são premissas editáveis, não cotações.</p>
          </section>
          <section class="panel stack" aria-labelledby="h-perf">
            <div class="panel-head"><div><span class="eyebrow">Perfis ilustrativos</span><h2 id="h-perf">Três regimes de risco</h2></div>
              <div class="seg" role="group" aria-label="Perfil">${Object.entries(D.PROFILES).map(([k, p]) => `<button data-action="inv-perfil" data-p="${k}" aria-pressed="${s.inv.perfil === k}">${p.nome}</button>`).join("")}</div></div>
            <div id="perfil-out">${profileOut(s)}</div>
          </section>
        </div>

        <section class="panel stack" aria-labelledby="h-sim">
          <div class="panel-head"><div><span class="eyebrow">Simulador</span><h2 id="h-sim">A renda composta da carteira</h2></div><span class="pill warn">não é promessa de retorno</span></div>
          <div class="split"><div id="sim-out" class="stack">${simOut(s)}</div>
            <div class="stack">${["inicial", "mensal", "yieldAA", "valAA", "anos"].map((k) => slider(s, k)).join("")}</div></div>
        </section>

        <div class="grid cols-2">
          <section class="panel stack" aria-labelledby="h-sc">
            <div class="panel-head"><div><span class="eyebrow">Painel do cotista</span><h2 id="h-sc">P/VP × dividend yield</h2></div><span class="eyebrow">fundos fictícios</span></div>
            <div id="scatter-out" class="stack">${scatterOut(s)}</div>
          </section>
          <section class="panel stack" aria-labelledby="h-ck">
            <div class="panel-head"><div><span class="eyebrow">Due diligence</span><h2 id="h-ck">Seu ritual de análise</h2></div></div>
            <div class="score-box" id="score-out">${scoreOut(s)}</div>
            ${groups.map((g) => `<div class="stack" style="gap:6px"><span class="eyebrow">${g}</span>${D.CHECKLIST.filter((c) => c.g === g).map((c) => `<label class="ck" for="ck-${c.id}"><input type="checkbox" id="ck-${c.id}" data-input="ck" data-id="${c.id}" ${s.inv.checklist.includes(c.id) ? "checked" : ""}><span>${esc(c.t)}</span></label>`).join("")}</div>`).join("")}
            <p class="hint">A meta não é 10/10: é saber quais itens você está deliberadamente pulando.</p>
          </section>
        </div>
        <p class="hint" style="text-align:center">Material educacional. Não constitui recomendação de investimento; rentabilidade passada não garante resultados futuros. Antes de investir, consulte um profissional certificado.</p>
      </div>`;
    },
  };

  function refresh() {
    const s = App.state;
    const put = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    put("selic-out", selicOut(s));
    put("sim-out", simOut(s));
    put("scatter-out", scatterOut(s));
  }

  App.inputs.inv = (el) => {
    const k = el.dataset.k;
    if (!SL[k]) return;
    const v = Math.min(SL[k][2], Math.max(SL[k][1], Number(el.value)));
    App.set((s) => ({ inv: { ...s.inv, [k]: v } }), { render: false });
    const o = document.getElementById("invv-" + k);
    if (o) o.textContent = SL[k][4](v);
    refresh();
  };
  App.inputs.ck = (el) => {
    const id = el.dataset.id;
    App.set((s) => ({ inv: { ...s.inv, checklist: el.checked ? [...new Set([...s.inv.checklist, id])] : s.inv.checklist.filter((x) => x !== id) } }), { render: false });
    const box = document.getElementById("score-out");
    if (box) box.innerHTML = scoreOut(App.state);
  };
  App.actions["inv-perfil"] = (el) => {
    if (!D.PROFILES[el.dataset.p]) return;
    App.set((s) => ({ inv: { ...s.inv, perfil: el.dataset.p } }), { render: false });
    document.querySelectorAll('[data-action="inv-perfil"]').forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.p === el.dataset.p)));
    const box = document.getElementById("perfil-out");
    if (box) box.innerHTML = profileOut(App.state);
  };
  App.actions.fii = (el) => {
    const i = Number(el.dataset.i);
    App.set((s) => ({ fiiSel: s.fiiSel === i ? null : i }), { render: false });
    const box = document.getElementById("scatter-out");
    if (box) box.innerHTML = scatterOut(App.state);
  };
})(typeof self !== "undefined" ? self : this);
