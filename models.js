/* Pure models and service guards from "PropTech — Do bairro à carteira".
   Every function returns new values; inputs are never mutated.
   Runs in the browser (window.PT) and in node (module.exports). */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PT = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---------- Territorial model, eq. (2)–(5) ----------
  function territorial({ P, h, q, u, g, c }) {
    const H = P / h;
    const R = q * H;
    const V = u * R;
    const a = (g * c * V) / 12;
    return { H, R, V, a, perYear: a * 12 };
  }

  // ---------- Portfolio economics, eq. (12)–(16) ----------
  function unitEconomics({ L, tau, v }) {
    const r = Math.round(tau * L * 100) / 100;
    return { r, m: Math.round((r - v) * 100) / 100 };
  }

  function breakEven({ F, m }) {
    if (F <= 0) return 0;
    if (m <= 0) return null;
    return Math.ceil(F / m - 1e-9);
  }

  function portfolioAt(N, { L, tau, v, F }) {
    const { r, m } = unitEconomics({ L, tau, v });
    return { receita: N * r, custo: F + N * v, saldo: N * m - F };
  }

  // ---------- Growth, eq. (17): N_t = (1 − d)·N_{t−1} + a ----------
  function growth({ a, d, months, N0 = 0 }) {
    const out = [N0];
    for (let t = 1; t <= months; t += 1) out.push((1 - d) * out[t - 1] + a);
    return out;
  }

  function monthsToTarget({ a, d, target, N0 = 0, limit = 240 }) {
    let n = N0;
    for (let t = 1; t <= limit; t += 1) {
      n = (1 - d) * n + a;
      if (n >= target) return t;
    }
    return null;
  }

  // ---------- Capacity, eq. (6)–(7) ----------
  function capacity({ D, s, b, eta, presence, proposal, activation }) {
    const K = Math.round(D * s * b * eta * 1e6) / 1e6;
    const attended = K * presence;
    const proposals = attended * proposal;
    return { K, attended, proposals, activations: proposals * activation };
  }

  function requiredSchedules(target, { presence, proposal, activation }) {
    const rate = presence * proposal * activation;
    return rate > 0 ? Math.ceil(target / rate - 1e-9) : null;
  }

  function requiredStaff(schedules, perProfessional) {
    return perProfessional > 0 ? Math.ceil(schedules / perProfessional) : null;
  }

  // ---------- Budget and cash, slides 14 and 19 ----------
  const BUDGET_B = Object.freeze([
    { item: "Marketing", min: 3000, max: 6000 },
    { item: "Jurídico / contabilidade", min: 1500, max: 3000 },
    { item: "Gestão / CRM / gateway", min: 500, max: 1000 },
    { item: "Hospedagem", min: 300, max: 800 },
    { item: "Assinatura eletrônica", min: 200, max: 500 },
    { item: "Mapas", min: 150, max: 400 },
    { item: "Mensagens", min: 100, max: 300 },
  ]);
  const BUDGET_A = Object.freeze([
    { item: "Equipe / atendimento", min: 6000, max: 12000 },
    { item: "Manutenção técnica", min: 1500, max: 3500 },
    { item: "Campo / fotos / deslocamento", min: 1000, max: 2500 },
    { item: "Contingência operacional", min: 500, max: 1500 },
  ]);

  function sumRange(lines) {
    return lines.reduce((acc, l) => ({ min: acc.min + l.min, max: acc.max + l.max }), { min: 0, max: 0 });
  }

  function grossOutlay({ monthly, months, dev }) {
    return { min: monthly.min * months + dev.min, max: monthly.max * months + dev.max };
  }

  // K = max(0, −min_t Σ(I − O)), starting from zero cash, eq. (21)
  function capitalNeed(netFlows) {
    let cum = 0;
    let low = 0;
    for (const f of netFlows) {
      cum += f;
      low = Math.min(low, cum);
    }
    return Math.max(0, -low);
  }

  // ---------- Cost transparency, slide 08 ----------
  function monthlyCost({ aluguel, condominio = 0, iptu = 0, seguro = 0 }) {
    return {
      itens: [
        { k: "Aluguel", v: aluguel },
        { k: "Condomínio", v: condominio },
        { k: "IPTU", v: iptu },
        { k: "Seguro incêndio", v: seguro },
      ],
      total: aluguel + condominio + iptu + seguro,
      naoIncluidos: ["garantia", "consumo"],
    };
  }

  // ---------- Guards: visits (slides 07 and 09) ----------
  function bookSlot(slots, slotId, visitId) {
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return { ok: false, slots, error: "Janela inexistente." };
    if (slot.visitId) return { ok: false, slots, error: "Janela já confirmada para outra visita." };
    return { ok: true, slots: slots.map((s) => (s.id === slotId ? { ...s, visitId } : s)) };
  }

  function requestVisit({ id, listingId, slotId, account = null }) {
    return { id, listingId, slotId, account, status: "solicitada", history: [{ status: "solicitada" }] };
  }

  function isConfirmedVisit(v) {
    return v.status === "confirmada" || v.status === "realizada";
  }

  function confirmVisit(visit, { accessConfirmed }) {
    if (visit.status !== "solicitada") return { ok: false, visit, error: "Só uma solicitação pode ser confirmada." };
    if (!accessConfirmed) return { ok: false, visit, error: "Acesso ao imóvel ainda não confirmado." };
    return { ok: true, visit: { ...visit, status: "confirmada", history: [...visit.history, { status: "confirmada" }] } };
  }

  // ---------- Guards: proposals ----------
  function createProposal({ id, ...terms }) {
    return { id, versions: [{ v: 1, ...terms }], acceptedVersion: null };
  }

  function reviseProposal(p, changes) {
    const last = p.versions[p.versions.length - 1];
    const next = { ...last, ...changes, v: last.v + 1 };
    return { ok: true, proposal: { ...p, versions: [...p.versions, next] } };
  }

  function acceptProposal(p) {
    if (p.acceptedVersion !== null) return { ok: false, proposal: p, error: "Proposta já aceita; valores mantidos." };
    return { ok: true, proposal: { ...p, acceptedVersion: p.versions[p.versions.length - 1].v } };
  }

  function acceptedTerms(p) {
    return p.acceptedVersion === null ? null : p.versions.find((x) => x.v === p.acceptedVersion);
  }

  // ---------- Guards: contracts ----------
  function startSignature({ id, signatories }) {
    return { id, status: "assinatura_iniciada", signatures: signatories.map((who) => ({ who, signed: false, valid: false })) };
  }

  function sign(contract, who, valid) {
    return {
      ...contract,
      signatures: contract.signatures.map((s) => (s.who === who ? { ...s, signed: true, valid: Boolean(valid) } : s)),
    };
  }

  function activateContract(contract) {
    const pending = contract.signatures.filter((s) => !s.signed || !s.valid);
    if (pending.length) {
      return { ok: false, contract, error: "Assinatura pendente ou inválida: " + pending.map((s) => s.who).join(", ") + "." };
    }
    return { ok: true, contract: { ...contract, status: "ativo" } };
  }

  // ---------- Guards: payment events (slide 10) ----------
  // Demo checksum standing in for a provider signature (HMAC in production).
  const DEMO_KEY = "demo-chave-publica";
  function checksum(e) {
    const s = [DEMO_KEY, e.id, e.kind, e.contractId, e.amount].join("|");
    let h = 5381;
    for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(16);
  }

  function signEvent(e) {
    return { ...e, sig: checksum(e) };
  }

  function emptyLedger() {
    return { seen: [], repasses: [], log: [] };
  }

  function ingestPaymentEvent(ledger, e) {
    if (!e || e.sig !== checksum(e)) {
      return { result: "rejeitado", ledger: { ...ledger, log: [...ledger.log, { id: e && e.id, result: "rejeitado" }] } };
    }
    if (ledger.seen.includes(e.id)) {
      return { result: "duplicado", ledger: { ...ledger, log: [...ledger.log, { id: e.id, result: "duplicado" }] } };
    }
    return {
      result: "aplicado",
      ledger: {
        seen: [...ledger.seen, e.id],
        repasses: [...ledger.repasses, { eventId: e.id, contractId: e.contractId, amount: e.amount }],
        log: [...ledger.log, { id: e.id, result: "aplicado" }],
      },
    };
  }

  // ---------- Guards: repasse (slide 11) ----------
  const REPASSE_FLOW = Object.freeze(["previsto", "conciliado", "autorizado", "confirmado"]);

  function newRepasse({ id, aluguel, tau }) {
    const taxa = Math.round(aluguel * tau * 100) / 100;
    return { id, aluguel, taxa, liquido: aluguel - taxa, status: "previsto" };
  }

  function advanceRepasse(r, next, { payment } = {}) {
    const i = REPASSE_FLOW.indexOf(r.status);
    if (REPASSE_FLOW[i + 1] !== next) return { ok: false, repasse: r, error: "Etapa fora de ordem." };
    if (next === "conciliado" && payment !== "conciliado") {
      return { ok: false, repasse: r, error: "Pagamento informado não é recebimento conciliado." };
    }
    return { ok: true, repasse: { ...r, status: next } };
  }

  // ---------- Guards: listings and access ----------
  const LISTING_FLOW = Object.freeze(["rascunho", "revisao", "publicado", "pausado"]);

  function publicListings(list) {
    return list.filter((l) => l.status === "publicado");
  }

  function canAccessDocument(viewer, doc) {
    if (viewer.role === "equipe") return (viewer.grants || []).includes(doc.id);
    if (viewer.role === "proprietario") return viewer.account === doc.ownerAccount;
    return viewer.account === doc.ownerAccount;
  }

  function visibleAddress(listing, viewer, visits) {
    if (viewer.role === "equipe") return listing.endereco;
    if (viewer.role === "proprietario" && viewer.account === listing.ownerAccount) return listing.endereco;
    const confirmed = visits.some((v) => v.listingId === listing.id && v.account === viewer.account && isConfirmedVisit(v));
    return confirmed ? listing.endereco : listing.bairro;
  }

  // ---------- Mini-AVM (deck section 08), fictional R$/m² per bairro ----------
  const AVM_M2 = Object.freeze({ ld: { A: 6400, B: 6650, C: 5600, D: 5900 }, sc: { A: 5630, B: 5850, C: 4930, D: 5190 } });
  const AVM_TIPO = Object.freeze({ Apartamento: 1, Studio: 1.12, Kitnet: 0.9, Loft: 1.05, Casa: 0.75, Sobrado: 0.78, Cobertura: 1.25 });
  const AVM_CONS = Object.freeze({ reformar: [0.86, 0.11], normal: [1, 0.07], reformado: [1.1, 0.07] });
  const AVM_RENT_YIELD = 0.0055;

  function avm({ city, bairro, tipo, area, conservacao = "normal", yieldMensal = AVM_RENT_YIELD }) {
    const base = (AVM_M2[city] || AVM_M2.ld)[bairro] || AVM_M2.ld.A;
    const [cons, band] = AVM_CONS[conservacao] || AVM_CONS.normal;
    const m2 = base * (AVM_TIPO[tipo] || 1) * cons * Math.pow(area / 70, -0.08);
    const central = m2 * area;
    const rent = central * yieldMensal;
    return {
      m2, central, min: central * (1 - band), max: central * (1 + band), band,
      aluguel: { central: rent, min: rent * (1 - band), max: rent * (1 + band) },
    };
  }

  // ---------- Wealth simulator (deck section 18): deposits at month end, income reinvested ----------
  function compound({ inicial, mensal, yieldAA, valAA, anos }) {
    const rm = Math.pow(1 + yieldAA + valAA, 1 / 12) - 1;
    let p = inicial;
    const serie = [inicial];
    for (let m = 1; m <= anos * 12; m += 1) {
      p = p * (1 + rm) + mensal;
      if (m % 12 === 0) serie.push(p);
    }
    const aportado = inicial + mensal * 12 * anos;
    return { serie, final: p, aportado, juros: p - aportado, rendaMensal: p * (Math.pow(1 + yieldAA, 1 / 12) - 1) };
  }

  // ---------- FII yield vs Selic (deck section 16), values in % a.a. ----------
  function fiiSpread({ yieldFII, selic, ir = 0.15 }) {
    const cdiLiquido = selic * (1 - ir);
    return { bruto: yieldFII - selic, cdiLiquido, liquido: yieldFII - cdiLiquido };
  }

  function checklistScore(checked, all) {
    return new Set(checked.filter((id) => all.includes(id))).size;
  }

  return Object.freeze({
    territorial, unitEconomics, breakEven, portfolioAt, growth, monthsToTarget,
    capacity, requiredSchedules, requiredStaff,
    BUDGET_B, BUDGET_A, sumRange, grossOutlay, capitalNeed, monthlyCost,
    bookSlot, requestVisit, isConfirmedVisit, confirmVisit,
    createProposal, reviseProposal, acceptProposal, acceptedTerms,
    startSignature, sign, activateContract,
    signEvent, emptyLedger, ingestPaymentEvent,
    REPASSE_FLOW, newRepasse, advanceRepasse,
    LISTING_FLOW, publicListings, canAccessDocument, visibleAddress,
    avm, AVM_TIPO, compound, fiiSpread, checklistScore,
  });
});
