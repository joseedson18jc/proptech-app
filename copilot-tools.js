/* Copilot tools: what the AI may do on the page. Read-only or UI-only (LGPD art. 20):
   filter, open, simulate, read, navigate. Nothing confirms, accepts, signs or authorizes.
   The schemas mirror the proxy's fixed copy (proptech-copilot/src/prompt.js). */
(function (root) {
  "use strict";
  const { App, PT } = root;

  function context() {
    const s = App.state;
    const listings = PT.publicListings(s.listings).map((l) => ({
      id: l.id, titulo: l.titulo, bairro: l.bairro, quartos: l.quartos, area_m2: l.area, aluguel: l.aluguel,
      custo_total_mes: PT.monthlyCost(l).total, verificado: Boolean(l.verificado), tags: l.tags,
    }));
    const cycle = App.cycle(s).map((c) => (c.full || c.k) + (c.done ? " ✓" : c.now ? " (agora)" : "")).join(" → ");
    return JSON.stringify({
      tela_atual: s.view, cidade_cenario: App.city(s).nome, ciclo_piloto: cycle, imoveis_publicados: listings,
      premissas: { L: s.sim.L, taxa: s.sim.tau, v: s.sim.v, F: s.sim.F, d: s.sim.d, cobertura_sc: s.sim.gSC, cobertura_ld: s.sim.gLD, captacao_c: s.sim.c },
      resultados: App.simSummary(s),
      investir: { selic: s.inv.selic, yield_fii: s.inv.yieldFII },
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
  }

  const DEFS = [
    {
      name: "buscar_imoveis", note: "filtrando imóveis",
      description: "Aplica filtros na busca do morador e mostra a tela de busca. Retorna até 6 imóveis publicados que atendem, ordenados pelo custo total mensal.",
      inputSchema: { type: "object", properties: {
        bairros: { type: "array", items: { type: "string", enum: ["A", "B", "C", "D"] } },
        custoMax: { type: "number", description: "Custo total mensal máximo em R$" },
        quartosMin: { type: "number" }, soVerificados: { type: "boolean" }, texto: { type: "string" } } },
      run(input) {
        const f = {
          q: typeof input.texto === "string" ? input.texto.slice(0, 60) : "",
          bairros: Array.isArray(input.bairros) ? input.bairros.map(String).filter((b) => ["A", "B", "C", "D"].includes(b)) : [],
          maxTotal: Number.isFinite(Number(input.custoMax)) ? Math.min(4500, Math.max(1200, Number(input.custoMax))) : 4500,
          quartos: Number.isFinite(Number(input.quartosMin)) ? Math.min(3, Math.max(0, Math.round(Number(input.quartosMin)))) : 0,
          verificados: Boolean(input.soVerificados),
          favs: false,
        };
        App.set({ filters: f, view: "morador", selectedId: null });
        return App.filteredListings(App.state).slice(0, 6).map((l) => ({ id: l.id, titulo: l.titulo, bairro: l.bairro, quartos: l.quartos, custo_total_mes: PT.monthlyCost(l).total }));
      },
    },
    {
      name: "abrir_imovel", note: "abrindo imóvel",
      description: "Abre o detalhe de um imóvel publicado pelo id (ex.: l1). Retorna custo detalhado.",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      run(input) {
        const l = PT.publicListings(App.state.listings).find((x) => x.id === String(input.id));
        if (!l) throw new Error("Imóvel não encontrado ou fora da busca pública.");
        App.openListing(l.id);
        return { id: l.id, titulo: l.titulo, custo: PT.monthlyCost(l).itens, total: PT.monthlyCost(l).total, nao_incluidos: ["garantia", "consumo"] };
      },
    },
    {
      name: "simular_carteira", note: "simulando carteira",
      description: "Altera premissas da economia da carteira e mostra a seção. Retorna receita r, contribuição m, contratos de equilíbrio e meses até lá por cidade.",
      inputSchema: { type: "object", properties: {
        aluguelMedio: { type: "number" }, taxa: { type: "number", description: "fração, ex.: 0.08" },
        custoVariavel: { type: "number" }, custoFixo: { type: "number" }, encerramentosMes: { type: "number", description: "fração, ex.: 0.01" } } },
      run(input) {
        applySim({ L: input.aluguelMedio, tau: input.taxa, v: input.custoVariavel, F: input.custoFixo, d: input.encerramentosMes });
        App.go("viabilidade", "sec-carteira");
        return App.simSummary(App.state);
      },
    },
    {
      name: "simular_praca", note: "simulando praça",
      description: "Troca a cidade do cenário e/ou premissas do modelo territorial, e mostra a seção Praça. Retorna ativações por mês e meses até o equilíbrio.",
      inputSchema: { type: "object", properties: {
        cidade: { type: "string", enum: ["sc", "ld"] }, coberturaSC: { type: "number" }, coberturaLD: { type: "number" },
        captacao: { type: "number" }, giro: { type: "number" }, alugadas: { type: "number" }, pessoasPorMoradia: { type: "number" } } },
      run(input) {
        if (input.cidade === "sc" || input.cidade === "ld") App.set({ city: input.cidade }, { render: false });
        applySim({ gSC: input.coberturaSC, gLD: input.coberturaLD, c: input.captacao, u: input.giro, q: input.alugadas, h: input.pessoasPorMoradia });
        App.go("viabilidade", "sec-praca");
        return App.simSummary(App.state);
      },
    },
    {
      name: "ler_operacao", note: "lendo a operação",
      description: "Lê o estado da operação: ciclo piloto, visitas, proposta, contrato, vistoria, pagamento, repasse e eventos. Não altera nada.",
      inputSchema: { type: "object", properties: {} },
      run() {
        const s = App.state;
        return {
          ciclo: App.cycle(s).map((c) => ({ etapa: c.full || c.k, concluida: c.done })),
          visitas: s.visits.map((v) => ({ imovel: App.listing(s, v.listingId).titulo, status: v.status })),
          proposta: s.proposal ? { versoes: s.proposal.versions.length, aceita: s.proposal.acceptedVersion } : null,
          contrato: s.contract ? s.contract.status : null, vistoria: Boolean(s.vistoria), pagamento: s.payment,
          repasse: s.repasse ? { status: s.repasse.status, liquido: s.repasse.liquido } : null,
          eventos: { recebidos: s.ledger.log.length, efeitos: s.ledger.repasses.length },
        };
      },
    },
    {
      name: "navegar", note: "mudando de tela",
      description: "Mostra uma visão do app: morador, dono (proprietário), operacao, investir ou viabilidade.",
      inputSchema: { type: "object", properties: { visao: { type: "string", enum: ["morador", "dono", "operacao", "investir", "viabilidade"] } }, required: ["visao"] },
      run(input) {
        const v = String(input.visao);
        if (!App.views[v]) throw new Error("Visão desconhecida.");
        App.go(v);
        return { ok: true };
      },
    },
  ];
  const BY_NAME = Object.fromEntries(DEFS.map((d) => [d.name, d]));

  // Runs one tool by name. Unknown names and failures become an error result, never a crash.
  function runTool(name, input, onNote) {
    const def = BY_NAME[name];
    if (!def) return { ok: false, content: "Ferramenta desconhecida: " + name };
    try {
      if (onNote) onNote(def.note);
      const out = def.run(input && typeof input === "object" ? input : {});
      return { ok: true, content: JSON.stringify(out).slice(0, 8000) };
    } catch (e) {
      return { ok: false, content: (e && e.message) || "Falha na ferramenta." };
    }
  }

  // Shape the sample capability expects: {name, description, inputSchema, execute}.
  function sampleTools(onNote) {
    return DEFS.map((d) => ({
      name: d.name, description: d.description, inputSchema: d.inputSchema,
      execute(input) {
        const r = runTool(d.name, input, onNote);
        if (!r.ok) throw new Error(r.content);
        return r.content;
      },
    }));
  }

  App.copilotTools = Object.freeze({ context, runTool, sampleTools, names: DEFS.map((d) => d.name) });
})(typeof self !== "undefined" ? self : this);
