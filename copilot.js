/* Copiloto: asks Claude through the viewer's own account (sample capability).
   Advisory only (LGPD art. 20): its tools filter, simulate, open and navigate.
   No tool confirms a visit, accepts a proposal, signs a contract or authorizes a payout. */
(function (root) {
  "use strict";
  const { App, PT } = root;
  const MAX_TURNS = 10;
  let sample = null;
  let canTools = false;
  let ready = false;
  let turns = [];
  let ctl = null;

  const RULES = [
    "Você é o Copiloto do PropTech, um app de locação residencial baseado no estudo “PropTech — Do bairro à carteira”.",
    "Responda em português do Brasil, em texto simples (sem Markdown), curto e direto: até 120 palavras, salvo pedido explícito.",
    "Todos os imóveis, pessoas e valores do app são fictícios de demonstração; só as populações do IBGE são dados reais.",
    "Você produz rascunhos, resumos, comparações e simulações. Nunca diga que confirmou visita, aceitou proposta, assinou contrato ou autorizou repasse: essas decisões são humanas e ficam com morador, proprietário ou equipe.",
    "Não invente imóveis nem números: use só o contexto e o resultado das ferramentas. Valores em R$.",
    "Sobre investimentos (FIIs, Selic, carteira): responda só de forma educacional. Não recomende comprar, vender ou alocar para a pessoa, não cite tickers reais e sugira consultar um profissional certificado.",
    "Quando ajudar, use as ferramentas para filtrar imóveis, abrir um imóvel, simular cenários ou navegar, e diga em uma frase o que mudou na tela.",
  ].join("\n");

  function context() {
    const s = App.state;
    const listings = PT.publicListings(s.listings).map((l) => ({
      id: l.id, titulo: l.titulo, bairro: l.bairro, quartos: l.quartos, area_m2: l.area, aluguel: l.aluguel,
      custo_total_mes: PT.monthlyCost(l).total, verificado: Boolean(l.verificado), tags: l.tags,
    }));
    const cycle = App.cycle(s).map((c) => c.k + (c.done ? " ✓" : c.now ? " (agora)" : "")).join(" → ");
    return JSON.stringify({
      tela_atual: s.view, cidade_cenario: App.city(s).nome, ciclo_piloto: cycle, imoveis_publicados: listings,
      premissas: { L: s.sim.L, taxa: s.sim.tau, v: s.sim.v, F: s.sim.F, d: s.sim.d, cobertura_sc: s.sim.gSC, cobertura_ld: s.sim.gLD, captacao_c: s.sim.c },
      resultados: App.simSummary(s),
    });
  }

  const clamp = (k, v) => {
    const lim = App.SIM_LIMITS[k];
    const n = Number(v);
    if (!lim || !Number.isFinite(n)) return undefined;
    return Math.min(lim[1], Math.max(lim[0], n));
  };
  function applySim(map) {
    const patch = {};
    Object.entries(map).forEach(([k, v]) => { if (v !== undefined && v !== null) { const c = clamp(k, v); if (c !== undefined) patch[k] = c; } });
    App.set((s) => ({ sim: { ...s.sim, ...patch } }));
    return patch;
  }

  function note(text) {
    const el = document.createElement("div");
    el.className = "msg tool";
    el.textContent = "→ " + text;
    log().appendChild(el);
    scroll();
  }

  const TOOLS = [
    {
      name: "buscar_imoveis",
      description: "Aplica filtros na busca do morador e mostra a tela de busca. Retorna até 6 imóveis publicados que atendem, ordenados pelo custo total mensal.",
      inputSchema: { type: "object", properties: {
        bairros: { type: "array", items: { type: "string", enum: ["A", "B", "C", "D"] } },
        custoMax: { type: "number", description: "Custo total mensal máximo em R$" },
        quartosMin: { type: "number" }, soVerificados: { type: "boolean" }, texto: { type: "string" } } },
      execute(input) {
        note("filtrando imóveis");
        const f = {
          q: typeof input.texto === "string" ? input.texto.slice(0, 60) : "",
          bairros: Array.isArray(input.bairros) ? input.bairros.map(String).filter((b) => ["A", "B", "C", "D"].includes(b)) : [],
          maxTotal: Number.isFinite(Number(input.custoMax)) ? Math.min(4500, Math.max(1200, Number(input.custoMax))) : 4500,
          quartos: Number.isFinite(Number(input.quartosMin)) ? Math.min(3, Math.max(0, Math.round(Number(input.quartosMin)))) : 0,
          verificados: Boolean(input.soVerificados),
        };
        App.set({ filters: f, view: "morador", selectedId: null });
        return App.filteredListings(App.state).slice(0, 6).map((l) => ({ id: l.id, titulo: l.titulo, bairro: l.bairro, quartos: l.quartos, custo_total_mes: PT.monthlyCost(l).total }));
      },
    },
    {
      name: "abrir_imovel",
      description: "Abre o detalhe de um imóvel publicado pelo id (ex.: l1). Retorna custo detalhado e status de visita.",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      execute(input) {
        const l = PT.publicListings(App.state.listings).find((x) => x.id === String(input.id));
        if (!l) throw new Error("Imóvel não encontrado ou fora da busca pública.");
        note("abrindo " + l.titulo);
        App.openListing(l.id);
        return { id: l.id, titulo: l.titulo, custo: PT.monthlyCost(l).itens, total: PT.monthlyCost(l).total, nao_incluidos: ["garantia", "consumo"] };
      },
    },
    {
      name: "simular_carteira",
      description: "Altera premissas da economia da carteira e mostra a seção. Retorna receita r, contribuição m, contratos de equilíbrio e meses até lá por cidade.",
      inputSchema: { type: "object", properties: {
        aluguelMedio: { type: "number" }, taxa: { type: "number", description: "fração, ex.: 0.08" },
        custoVariavel: { type: "number" }, custoFixo: { type: "number" }, encerramentosMes: { type: "number", description: "fração, ex.: 0.01" } } },
      execute(input) {
        note("simulando carteira");
        applySim({ L: input.aluguelMedio, tau: input.taxa, v: input.custoVariavel, F: input.custoFixo, d: input.encerramentosMes });
        App.go("viabilidade", "sec-carteira");
        return App.simSummary(App.state);
      },
    },
    {
      name: "simular_praca",
      description: "Troca a cidade do cenário e/ou premissas do modelo territorial, e mostra a seção Praça. Retorna ativações por mês e meses até o equilíbrio.",
      inputSchema: { type: "object", properties: {
        cidade: { type: "string", enum: ["sc", "ld"] }, coberturaSC: { type: "number" }, coberturaLD: { type: "number" },
        captacao: { type: "number" }, giro: { type: "number" }, alugadas: { type: "number" }, pessoasPorMoradia: { type: "number" } } },
      execute(input) {
        note("simulando praça");
        if (input.cidade === "sc" || input.cidade === "ld") App.set({ city: input.cidade }, { render: false });
        applySim({ gSC: input.coberturaSC, gLD: input.coberturaLD, c: input.captacao, u: input.giro, q: input.alugadas, h: input.pessoasPorMoradia });
        App.go("viabilidade", "sec-praca");
        return App.simSummary(App.state);
      },
    },
    {
      name: "ler_operacao",
      description: "Lê o estado da operação: ciclo piloto, visitas, proposta, contrato, vistoria, pagamento, repasse e eventos. Não altera nada.",
      inputSchema: { type: "object", properties: {} },
      execute() {
        note("lendo a operação");
        const s = App.state;
        return {
          ciclo: App.cycle(s).map((c) => ({ etapa: c.k, concluida: c.done })),
          visitas: s.visits.map((v) => ({ imovel: App.listing(s, v.listingId).titulo, status: v.status })),
          proposta: s.proposal ? { versoes: s.proposal.versions.length, aceita: s.proposal.acceptedVersion } : null,
          contrato: s.contract ? s.contract.status : null, vistoria: Boolean(s.vistoria), pagamento: s.payment,
          repasse: s.repasse ? { status: s.repasse.status, liquido: s.repasse.liquido } : null,
          eventos: { recebidos: s.ledger.log.length, efeitos: s.ledger.repasses.length },
        };
      },
    },
    {
      name: "navegar",
      description: "Mostra uma visão do app: morador, dono (proprietário), operacao, investir ou viabilidade.",
      inputSchema: { type: "object", properties: { visao: { type: "string", enum: ["morador", "dono", "operacao", "investir", "viabilidade"] } }, required: ["visao"] },
      execute(input) {
        const v = String(input.visao);
        if (!App.views[v]) throw new Error("Visão desconhecida.");
        note("abrindo " + v);
        App.go(v);
        return { ok: true };
      },
    },
  ];

  const COPY = {
    rate_limited: "Muitas perguntas em pouco tempo. Tente de novo em instantes.",
    session_expired: "Sua sessão do Claude expirou. Entre de novo e tente outra vez.",
    refused: "O copiloto não pode responder a isso. Reformule a pergunta.",
    empty_completion: "Sem resposta desta vez. Pergunte de outro jeito.",
    prompt_too_large: "A conversa ficou longa demais. Limpe a conversa e pergunte de novo.",
    tools_unavailable: "Esta visualização não deixa o copiloto mexer na tela. Pergunte de novo: ele responde só com texto.",
    upstream_error: "A conexão falhou no meio da resposta. Tente de novo.",
  };
  const HIDE = ["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"];

  const panel = () => document.getElementById("copilot");
  const log = () => document.getElementById("cpLog");
  const scroll = () => { const l = log(); if (l) l.scrollTop = l.scrollHeight; };

  function bubble(cls, text) {
    const el = document.createElement("div");
    el.className = "msg " + cls;
    el.textContent = text;
    log().appendChild(el);
    scroll();
    return el;
  }

  const SUGGEST = [
    "Quais imóveis cabem em R$ 2.500 por mês no Bairro A?",
    "Simule taxa de 8% e custo variável de R$ 90.",
    "Por que Londrina rende mais ativações com metade da cobertura?",
    "Resuma o que falta para o 1º repasse conciliado.",
  ];

  function shell() {
    const p = panel();
    p.innerHTML = `
      <div class="cp-head"><span class="cp-orb" aria-hidden="true"></span><div style="flex:1"><b style="font-family:var(--f-display)">Copiloto</b><div class="eyebrow">rascunhos e simulações</div></div>
        <button class="btn ghost small" data-action="cp-clear">Limpar</button>
        <button class="btn ghost icon" data-action="cp-close" aria-label="Fechar copiloto"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" fill="none"/></svg></button></div>
      <div class="cp-note">A IA gera rascunhos e resumos e pode filtrar, simular e navegar. Decisões relevantes (visita, aceite, assinatura, repasse) têm revisão humana · LGPD art. 20.</div>
      <div class="cp-log" id="cpLog" aria-live="polite"></div>
      <div class="stack" id="cpFoot"></div>`;
    renderFoot();
  }

  function renderFoot() {
    const foot = document.getElementById("cpFoot");
    if (!foot) return;
    if (!ready) { foot.innerHTML = `<div class="callout">Conectando ao Claude…</div>`; return; }
    if (!sample) {
      foot.innerHTML = `<div class="callout"><b>Copiloto indisponível nesta visualização.</b>Ele usa o Claude de quem está vendo a página, com permissão. Abra o app no Claude para conversar; o resto do app funciona sem ele.</div>`;
      return;
    }
    foot.innerHTML = `<div class="cp-suggest">${SUGGEST.map((q) => `<button class="chip" data-action="cp-suggest" data-q="${App.esc(q)}">${App.esc(q)}</button>`).join("")}</div>
      <form class="cp-form" id="cpForm"><textarea id="cpInput" placeholder="Pergunte sobre imóveis, custos ou cenários…" aria-label="Mensagem para o copiloto" maxlength="1200"></textarea>
      <button class="btn primary" id="cpSend" type="submit">Enviar</button></form>`;
    const form = document.getElementById("cpForm");
    const input = document.getElementById("cpInput");
    form.addEventListener("submit", (e) => { e.preventDefault(); send(input.value); });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input.value); } });
  }

  function setBusy(on) {
    const btn = document.getElementById("cpSend");
    if (!btn) return;
    btn.textContent = on ? "Parar" : "Enviar";
    btn.type = on ? "button" : "submit";
    btn.onclick = on ? () => ctl && ctl.abort() : null;
  }

  async function send(text) {
    const q = String(text || "").trim();
    if (!q || !sample || ctl) return;
    const input = document.getElementById("cpInput");
    if (input) input.value = "";
    bubble("user", q);
    turns = [...turns, { role: "user", content: q }].slice(-MAX_TURNS);
    if (turns[0].role !== "user") turns = turns.slice(1);
    const out = bubble("ai", "");
    out.innerHTML = '<span class="thinking" aria-label="Pensando"><i></i><i></i><i></i></span>';
    ctl = new AbortController();
    setBusy(true);
    const lead = { role: "user", content: RULES + "\n\nContexto atual do app (JSON):\n" + context() };
    const opts = { signal: ctl.signal, modelTier: "quick", onText: ({ text: t }) => { out.textContent = t; scroll(); } };
    if (canTools) opts.tools = TOOLS;
    else opts.cache = false;
    try {
      const res = await sample([lead, ...turns], opts);
      out.textContent = res.text;
      const tag = document.createElement("span");
      tag.className = "draft";
      tag.textContent = res.truncated ? "rascunho de IA · resposta cortada" : "rascunho de IA · revise antes de decidir";
      out.appendChild(tag);
      turns = [...turns, { role: "assistant", content: res.text }].slice(-MAX_TURNS);
    } catch (e) {
      const code = e && e.code;
      if (code === "refused") out.textContent = "";
      else if (e && e.text) out.textContent = e.text;
      else out.textContent = "";
      if (code === "cancelled") {
        out.textContent = (out.textContent || "") + (out.textContent ? "\n" : "") + "(interrompido)";
      } else if (HIDE.includes(code)) {
        out.remove();
        sample = null;
        renderFoot();
      } else {
        if (code === "tools_unavailable") canTools = false;
        out.classList.add("err");
        out.textContent = (out.textContent ? out.textContent + "\n\n" : "") + (COPY[code] || COPY.upstream_error);
      }
      turns = turns.slice(0, -1);
    } finally {
      ctl = null;
      setBusy(false);
      scroll();
    }
  }

  App.openCopilot = (q) => {
    const p = panel();
    if (!p.innerHTML) shell();
    p.hidden = false;
    document.getElementById("app").classList.add("cp-open");
    if (q && sample) send(q);
    else { const i = document.getElementById("cpInput"); if (i) i.focus(); }
  };
  App.closeCopilot = () => {
    const p = panel();
    if (p) p.hidden = true;
    document.getElementById("app").classList.remove("cp-open");
  };
  App.actions.copilot = () => (panel().hidden ? App.openCopilot() : App.closeCopilot());
  App.actions["cp-close"] = () => App.closeCopilot();
  App.actions["cp-clear"] = () => { if (ctl) ctl.abort(); turns = []; const l = log(); if (l) l.innerHTML = ""; };
  App.actions["cp-suggest"] = (el) => send(el.dataset.q);
  App.actions["ask-copilot"] = (el) => App.openCopilot(el.dataset.q);

  App.initCopilot = async (hasRuntime) => {
    try {
      sample = hasRuntime ? await root.claude.use("sample") : null;
      if (sample) {
        const lim = await sample.limits().catch(() => null);
        canTools = Boolean(lim && lim.tools);
      }
    } catch (_) {
      sample = null;
    }
    ready = true;
    renderFoot();
  };
})(typeof self !== "undefined" ? self : this);
