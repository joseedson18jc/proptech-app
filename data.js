/* Seed data. Every listing, person, address and amount is fictional;
   only city populations (IBGE) are real facts. */
(function (root) {
  "use strict";

  const CITIES = Object.freeze({
    sc: { id: "sc", nome: "São Carlos", uf: "SP", P: 267441, censo: 254857, ibge: "3548906", g: 0.3 },
    ld: { id: "ld", nome: "Londrina", uf: "PR", P: 584465, censo: 555965, ibge: "4113700", g: 0.15 },
  });

  // Schematic map, no scale, fictional neighborhoods (deck slide 06).
  const BAIRROS = Object.freeze([
    { id: "A", nome: "Bairro A", fase: 1, poly: "36,40 300,26 318,198 58,222", label: [150, 120] },
    { id: "B", nome: "Bairro B", fase: 1, poly: "322,26 604,48 592,206 334,198", label: [460, 118] },
    { id: "C", nome: "Bairro C", fase: 2, poly: "58,230 318,206 330,392 40,382", label: [180, 306] },
    { id: "D", nome: "Bairro D", fase: 2, poly: "334,206 592,214 604,392 342,392", label: [466, 304] },
  ]);
  const BASE = Object.freeze({ x: 322, y: 200 });

  const L = (o) => Object.freeze({ seguro: 0, condominio: 0, tags: [], verificado: null, ...o });
  const LISTINGS = Object.freeze([
    L({ id: "l1", titulo: "Apartamento Jardim", tipo: "Apartamento", bairro: "A", quartos: 2, area: 68, aluguel: 2400, condominio: 420, iptu: 80, seguro: 30, status: "publicado", ownerAccount: "acc_dono_1", x: 132, y: 96, tags: ["Vaga", "Varanda"], verificado: { data: "2026-10-12", evidencia: "Autorização escrita e visita de campo" }, endereco: "Rua Exemplo das Acácias, 120 · ap. 32" }),
    L({ id: "l2", titulo: "Studio Centro Vivo", tipo: "Studio", bairro: "A", quartos: 1, area: 34, aluguel: 1450, condominio: 310, iptu: 45, seguro: 18, status: "publicado", ownerAccount: "acc_dono_3", x: 222, y: 72, tags: ["Mobiliado"], verificado: { data: "2026-10-09", evidencia: "Autorização escrita e fotos datadas" }, endereco: "Av. Fictícia Central, 455 · ap. 101" }),
    L({ id: "l3", titulo: "Casa Vila das Flores", tipo: "Casa", bairro: "A", quartos: 3, area: 120, aluguel: 2900, iptu: 140, seguro: 42, status: "publicado", ownerAccount: "acc_dono_4", x: 96, y: 176, tags: ["Quintal", "Pet"], verificado: { data: "2026-10-05", evidencia: "Autorização escrita" }, endereco: "Rua Modelo dos Ipês, 78" }),
    L({ id: "l4", titulo: "Apartamento Mirante", tipo: "Apartamento", bairro: "B", quartos: 2, area: 72, aluguel: 2650, condominio: 520, iptu: 95, seguro: 32, status: "publicado", ownerAccount: "acc_dono_5", x: 402, y: 84, tags: ["Vaga", "Elevador"], verificado: { data: "2026-10-13", evidencia: "Autorização escrita e visita de campo" }, endereco: "Rua Hipotética do Mirante, 300 · ap. 84" }),
    L({ id: "l5", titulo: "Kitnet Universitária", tipo: "Kitnet", bairro: "B", quartos: 1, area: 28, aluguel: 980, condominio: 180, iptu: 30, seguro: 14, status: "publicado", ownerAccount: "acc_dono_6", x: 520, y: 150, tags: ["Pet", "Mobiliado"], endereco: "Rua Exemplo do Campus, 12 · un. 7" }),
    L({ id: "l6", titulo: "Apartamento Parque", tipo: "Apartamento", bairro: "B", quartos: 3, area: 96, aluguel: 3400, condominio: 690, iptu: 150, seguro: 40, status: "publicado", ownerAccount: "acc_dono_7", x: 470, y: 64, tags: ["2 vagas", "Lazer"], verificado: { data: "2026-10-08", evidencia: "Autorização escrita e fotos datadas" }, endereco: "Alameda Fictícia do Parque, 900 · ap. 121" }),
    L({ id: "l7", titulo: "Casa Recanto", tipo: "Casa", bairro: "B", quartos: 2, area: 85, aluguel: 2100, iptu: 90, seguro: 30, status: "pausado", ownerAccount: "acc_dono_8", x: 560, y: 96, tags: ["Quintal"], endereco: "Rua Modelo do Recanto, 51" }),
    L({ id: "l8", titulo: "Apartamento Jardim II", tipo: "Apartamento", bairro: "A", quartos: 2, area: 64, aluguel: 2250, condominio: 400, iptu: 75, seguro: 28, status: "revisao", ownerAccount: "acc_dono_1", x: 178, y: 150, tags: ["Vaga"], endereco: "Rua Exemplo das Acácias, 120 · ap. 54" }),
    L({ id: "l9", titulo: "Sobrado Bosque", tipo: "Sobrado", bairro: "C", quartos: 3, area: 140, aluguel: 3600, iptu: 180, seguro: 48, status: "rascunho", ownerAccount: "acc_dono_1", x: 150, y: 300, tags: ["Quintal", "Pet"], endereco: "Rua Hipotética do Bosque, 230" }),
    L({ id: "l10", titulo: "Apartamento Lago", tipo: "Apartamento", bairro: "D", quartos: 2, area: 70, aluguel: 2300, condominio: 450, iptu: 85, seguro: 30, status: "rascunho", ownerAccount: "acc_dono_9", x: 470, y: 320, tags: ["Vaga"], endereco: "Av. Modelo do Lago, 1500 · ap. 23" }),
    L({ id: "l11", titulo: "Loft Estação", tipo: "Loft", bairro: "B", quartos: 1, area: 45, aluguel: 1750, condominio: 350, iptu: 60, seguro: 20, status: "publicado", ownerAccount: "acc_dono_10", x: 372, y: 160, tags: ["Mobiliado", "Pet"], verificado: { data: "2026-10-11", evidencia: "Autorização escrita" }, endereco: "Rua Fictícia da Estação, 88 · loft 3" }),
    L({ id: "l12", titulo: "Apartamento Horizonte", tipo: "Apartamento", bairro: "A", quartos: 2, area: 75, aluguel: 2550, condominio: 480, iptu: 90, seguro: 32, status: "publicado", ownerAccount: "acc_dono_11", x: 252, y: 168, tags: ["Vaga", "Varanda"], verificado: { data: "2026-10-14", evidencia: "Autorização escrita e visita de campo" }, endereco: "Rua Exemplo do Horizonte, 640 · ap. 72" }),
  ]);

  const VIEWERS = Object.freeze({
    morador: Object.freeze({ role: "morador", account: "acc_m_1", nome: "Morador (conta demo)" }),
    proprietario: Object.freeze({ role: "proprietario", account: "acc_dono_1", nome: "Proprietário (conta demo)" }),
    equipe: Object.freeze({ role: "equipe", account: "acc_eq", nome: "Equipe de operação", grants: ["d1", "d2"] }),
  });

  const DOCUMENTS = Object.freeze([
    { id: "d1", titulo: "Matrícula · Apartamento Jardim", ownerAccount: "acc_dono_1", kind: "matricula" },
    { id: "d2", titulo: "Autorização de anúncio · Jardim II", ownerAccount: "acc_dono_1", kind: "autorizacao" },
    { id: "d3", titulo: "Laudo de vistoria · Apartamento Mirante", ownerAccount: "acc_dono_5", kind: "vistoria" },
    { id: "d4", titulo: "Documento de renda · morador", ownerAccount: "acc_m_1", kind: "renda" },
  ]);

  const WINDOWS = Object.freeze(["09:00", "13:00", "17:00"]);
  function businessDays(n, from) {
    const out = [];
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    while (out.length < n) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) out.push(new Date(d));
    }
    return out;
  }
  function makeSlots(listings, now) {
    const days = businessDays(3, now);
    const slots = [];
    listings.forEach((l, li) => {
      days.forEach((d, di) => {
        WINDOWS.forEach((w, wi) => {
          const taken = (li + di * 2 + wi) % 4 === 0;
          slots.push({ id: `${l.id}-${di}-${wi}`, listingId: l.id, day: d.toISOString().slice(0, 10), time: w, visitId: taken ? "ocupada" : null });
        });
      });
    });
    return slots;
  }

  // Other fictional contracts that keep the operation board realistic.
  const BACKLOG = Object.freeze([
    { id: "bk1", coluna: "visitas", titulo: "Confirmar acesso · Apartamento Mirante", responsavel: "Operação", prazo: "hoje 16:00", sev: "warn" },
    { id: "bk2", coluna: "propostas", titulo: "Rever pendência de renda · Loft Estação", responsavel: "Análise", prazo: "amanhã", sev: "info" },
    { id: "bk3", coluna: "contratos", titulo: "Vistoria de saída · contrato #0412", responsavel: "Operação, corretagem", prazo: "sex", sev: "info" },
    { id: "bk4", coluna: "repasses", titulo: "Conciliar aluguel · contrato #0398", responsavel: "Financeiro", prazo: "D+2", sev: "warn" },
    { id: "bk5", coluna: "chamados", titulo: "Chamado: vazamento no banheiro · #0377", responsavel: "Manutenção", prazo: "SLA 24 h", sev: "crit" },
  ]);

  const SEED_EVENTS = Object.freeze([
    { id: "evt_0398", kind: "pagamento", contractId: "c-0398", amount: 1980 },
    { id: "evt_0401", kind: "pagamento", contractId: "c-0401", amount: 2250 },
  ]);

  const KPIS = Object.freeze([
    { k: "Disponibilidade", meta: "≥ 90%", alvo: 0.9, valor: 0.93, formula: "confirmados na semana ÷ elegíveis" },
    { k: "Presença", meta: "≥ 75%", alvo: 0.75, valor: 0.71, formula: "realizadas ÷ confirmadas na coorte" },
    { k: "No prazo", meta: "≥ 95%", alvo: 0.95, valor: 0.96, formula: "respondidas no SLA ÷ elegíveis" },
    { k: "Ativação", meta: "medir antes", alvo: null, valor: 0.38, formula: "ativos ÷ propostas válidas da coorte" },
    { k: "Repasse", meta: "prazo a definir", alvo: null, valor: 1, formula: "confirmados no prazo ÷ devidos" },
    { k: "Contribuição", meta: "positiva", alvo: 0, valor: 140, formula: "receita própria − variáveis, por contrato", moeda: true },
  ]);

  const RISKS = Object.freeze([
    ["Anúncio desatualizado", "Autorização escrita e reconfirmação semanal", "Operação, corretagem"],
    ["Visita sem acesso", "Confirmação, cancelamento e registro", "Operação"],
    ["Dados divergentes", "Acesso restrito, conferência e exceção", "Análise, jurídico"],
    ["Fraude ou repasse repetido", "Canal independente, dupla revisão, idempotência", "Financeiro, tecnologia"],
    ["Fornecedor indisponível", "Fila de falhas, contingência e suporte", "Tecnologia"],
    ["Volume acima da capacidade", "Limite de campanha e abertura por região", "Direção, operação"],
    ["Margem insuficiente", "Rever preço, variável, mix e estrutura", "Direção, financeiro"],
  ]);

  // 14-week roadmap (slide 21): [track, startWeek, endWeek, gate]
  const ROADMAP = Object.freeze([
    { trilha: "Produto / direção", ini: 1, fim: 3, entrega: "Cidade, bairros, entrevistas, caixa", porta: "Acesso comprovável à oferta" },
    { trilha: "Operações", ini: 3, fim: 7, entrega: "Serviço assistido, primeiros imóveis", porta: "Jornada executável" },
    { trilha: "Tecnologia / produto", ini: 2, fim: 11, entrega: "MVP e testes integrados", porta: "Fluxo completo, exceções tratadas" },
    { trilha: "Operação / financeiro", ini: 11, fim: 14, entrega: "Piloto controlado", porta: "Contrato, vistoria e repasse reais" },
  ]);

  // ---------- Investir (illustrative, from the interactive deck; not a recommendation) ----------
  const EIXOS = Object.freeze(["Renda", "Estabilidade", "Liquidez", "Valorização", "Risco"]);
  const PROFILES = Object.freeze({
    conservador: { nome: "Conservador", resumo: "Renda estável, papel na base", alloc: { Papel: 50, Tijolo: 30, "Fundo de fundos": 15, Desenvolvimento: 5 }, eixos: [5, 5, 4, 2, 1] },
    moderado: { nome: "Moderado", resumo: "Renda e valorização equilibradas", alloc: { Papel: 35, Tijolo: 40, "Fundo de fundos": 15, Desenvolvimento: 10 }, eixos: [4, 4, 4, 3, 3] },
    arrojado: { nome: "Arrojado", resumo: "Mais valorização, mais risco", alloc: { Papel: 20, Tijolo: 45, "Fundo de fundos": 10, Desenvolvimento: 25 }, eixos: [3, 2, 3, 5, 5] },
  });
  // Fictional funds for the P/VP × dividend yield scatter. Not real tickers.
  const FIIS = Object.freeze([
    { nome: "Lajes Alfa", seg: "tijolo", pvp: 0.78, dy: 11.4 }, { nome: "Lajes Beta", seg: "tijolo", pvp: 0.86, dy: 10.1 },
    { nome: "Galpões Gama", seg: "tijolo", pvp: 1.02, dy: 9.3 }, { nome: "Shopping Delta", seg: "tijolo", pvp: 0.94, dy: 9.8 },
    { nome: "Logística Épsilon", seg: "tijolo", pvp: 1.12, dy: 8.6 }, { nome: "Recebíveis Zeta", seg: "papel", pvp: 0.97, dy: 13.2 },
    { nome: "Recebíveis Eta", seg: "papel", pvp: 1.04, dy: 12.4 }, { nome: "CRI Teta", seg: "papel", pvp: 0.88, dy: 14.1 },
    { nome: "CRI Iota", seg: "papel", pvp: 1.08, dy: 11.7 }, { nome: "Multi Kappa", seg: "fof", pvp: 0.84, dy: 10.6 },
    { nome: "Multi Lambda", seg: "fof", pvp: 0.91, dy: 9.9 }, { nome: "Obra Mu", seg: "desenvolvimento", pvp: 0.72, dy: 7.2 },
    { nome: "Obra Nu", seg: "desenvolvimento", pvp: 1.18, dy: 6.4 }, { nome: "Lajes Xi", seg: "tijolo", pvp: 0.69, dy: 12.6 },
  ]);
  const CHECKLIST = Object.freeze([
    { id: "c1", g: "Bairro", t: "Preço/m² e tendência de 12 meses da região" },
    { id: "c2", g: "Bairro", t: "Vacância e oferta nova no entorno" },
    { id: "c3", g: "Bairro", t: "Days-on-market: velocidade de locação ou venda" },
    { id: "c4", g: "Papel", t: "P/VP contra o histórico do próprio fundo" },
    { id: "c5", g: "Papel", t: "Dividend yield contra o CDI líquido de IR" },
    { id: "c6", g: "Papel", t: "Concentração por inquilino abaixo de 20%" },
    { id: "c7", g: "Papel", t: "Indexador e prazo médio dos contratos" },
    { id: "c8", g: "Papel", t: "Liquidez diária suficiente para sair da posição" },
    { id: "c9", g: "Gestão", t: "Histórico do gestor, aquisições e taxas" },
    { id: "c10", g: "Carteira", t: "Teto por posição e diversificação geográfica" },
  ]);
  // Neighborhood radar (deck section 07), fictional values per city.
  const RADAR_METRICS = Object.freeze([
    { k: "val", t: "Valorização 12m", u: "%", good: "high" }, { k: "vac", t: "Vacância", u: "%", good: "low" },
    { k: "dom", t: "Days-on-market", u: " d", good: "low" }, { k: "oferta", t: "Oferta nova", u: " un.", good: "low" },
  ]);
  const BAIRRO_RADAR = Object.freeze({
    ld: { A: { val: 7.9, vac: 6.2, dom: 38, oferta: 120 }, B: { val: 9.4, vac: 5.1, dom: 31, oferta: 210 }, C: { val: 4.2, vac: 11.8, dom: 64, oferta: 340 }, D: { val: 5.6, vac: 9.3, dom: 52, oferta: 180 } },
    sc: { A: { val: 6.1, vac: 7.4, dom: 44, oferta: 90 }, B: { val: 8.2, vac: 6.0, dom: 36, oferta: 140 }, C: { val: 3.5, vac: 12.9, dom: 71, oferta: 260 }, D: { val: 4.8, vac: 10.2, dom: 58, oferta: 150 } },
  });

  // Operational administration fee for live contracts (deck base case). Simulations never change it.
  const TAXA_ADM = 0.1;

  root.PTData = Object.freeze({ TAXA_ADM, EIXOS, PROFILES, FIIS, CHECKLIST, RADAR_METRICS, BAIRRO_RADAR, CITIES, BAIRROS, BASE, LISTINGS, VIEWERS, DOCUMENTS, WINDOWS, makeSlots, BACKLOG, SEED_EVENTS, KPIS, RISKS, ROADMAP });
})(typeof self !== "undefined" ? self : this);
