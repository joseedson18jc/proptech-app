// Checks the study's numbers (deck slides 05–19) and the service guards (slides 07–11).
const test = require("node:test");
const assert = require("node:assert/strict");
const PT = require("../models.js");

const round2 = (x) => Math.round(x * 100) / 100;

test("territorial model reproduces São Carlos and Londrina activations", () => {
  const base = { h: 2.8, q: 0.25, u: 0.2, c: 0.08 };
  const sc = PT.territorial({ ...base, P: 267441, g: 0.3 });
  const ld = PT.territorial({ ...base, P: 584465, g: 0.15 });
  assert.equal(round2(sc.H), 95514.64);
  assert.equal(round2(sc.R), 23878.66);
  assert.equal(round2(sc.V), 4775.73);
  assert.equal(round2(sc.a), 9.55);
  assert.equal(round2(ld.a), 10.44);
  assert.equal(round2(ld.perYear), 125.24);
});

test("unit economics and break-even give 143 contracts", () => {
  const { r, m } = PT.unitEconomics({ L: 2000, tau: 0.1, v: 60 });
  assert.equal(r, 200);
  assert.equal(m, 140);
  assert.equal(PT.breakEven({ F: 20000, m }), 143);
});

test("break-even returns null when contribution is not positive", () => {
  assert.equal(PT.breakEven({ F: 20000, m: 0 }), null);
  assert.equal(PT.breakEven({ F: 20000, m: -5 }), null);
  assert.equal(PT.breakEven({ F: 0, m: 140 }), 0);
});

test("portfolio at 142 is a deficit and at 143 covers the fixed cost", () => {
  const p = { L: 2000, tau: 0.1, v: 60, F: 20000 };
  assert.deepEqual(PT.portfolioAt(142, p), { receita: 28400, custo: 28520, saldo: -120 });
  assert.deepEqual(PT.portfolioAt(143, p), { receita: 28600, custo: 28580, saldo: 20 });
});

test("sensitivity shocks match the deck", () => {
  const be = (tau, v, F) => PT.breakEven({ F, m: PT.unitEconomics({ L: 2000, tau, v }).m });
  assert.equal(be(0.08, 60, 20000), 200);
  assert.equal(be(0.1, 90, 20000), 182);
  assert.equal(be(0.1, 60, 25000), 179);
  assert.equal(be(0.08, 90, 20000), 286);
});

test("recurrence reaches 143 in month 15 (Londrina) and 17 (São Carlos)", () => {
  const base = { h: 2.8, q: 0.25, u: 0.2, c: 0.08 };
  const aSC = PT.territorial({ ...base, P: 267441, g: 0.3 }).a;
  const aLD = PT.territorial({ ...base, P: 584465, g: 0.15 }).a;
  assert.equal(PT.monthsToTarget({ a: aLD, d: 0.01, target: 143 }), 15);
  assert.equal(PT.monthsToTarget({ a: aSC, d: 0.01, target: 143 }), 17);
  const series = PT.growth({ a: 10, d: 0.01, months: 3 });
  assert.equal(series.length, 4);
  assert.equal(series[0], 0);
  assert.equal(round2(series[2]), 19.9);
});

test("capacity funnel gives 2.88 activations and 167 schedules for 10", () => {
  const cap = PT.capacity({ D: 20, s: 3, b: 1, eta: 0.8, presence: 0.75, proposal: 0.2, activation: 0.4 });
  assert.equal(cap.K, 48);
  assert.equal(round2(cap.attended), 36);
  assert.equal(round2(cap.proposals), 7.2);
  assert.equal(round2(cap.activations), 2.88);
  const need = PT.requiredSchedules(10, { presence: 0.75, proposal: 0.2, activation: 0.4 });
  assert.equal(need, 167);
  assert.equal(PT.requiredStaff(need, 48), 4);
});

test("budget sums to 14.750–31.500 and gross outlay to 108.5–224 mil", () => {
  assert.deepEqual(PT.sumRange(PT.BUDGET_B), { min: 5750, max: 12000 });
  assert.deepEqual(PT.sumRange(PT.BUDGET_A), { min: 9000, max: 19500 });
  const out = PT.grossOutlay({ monthly: PT.sumRange([...PT.BUDGET_B, ...PT.BUDGET_A]), months: 6, dev: { min: 20000, max: 35000 } });
  assert.deepEqual(out, { min: 108500, max: 224000 });
});

test("minimum capital is the deepest cumulative cash hole", () => {
  assert.equal(PT.capitalNeed([-10, -5, 8, 20]), 15);
  assert.equal(PT.capitalNeed([5, 5]), 0);
});

test("a visit window can be confirmed only once", () => {
  const slots = [{ id: "s1", visitId: null }];
  const first = PT.bookSlot(slots, "s1", "v1");
  assert.equal(first.ok, true);
  assert.equal(slots[0].visitId, null, "input is not mutated");
  const second = PT.bookSlot(first.slots, "s1", "v2");
  assert.equal(second.ok, false);
  assert.match(second.error, /já confirmada/);
});

test("a visit request is not a confirmed visit", () => {
  const v = PT.requestVisit({ id: "v1", listingId: "l1", slotId: "s1" });
  assert.equal(v.status, "solicitada");
  assert.equal(PT.isConfirmedVisit(v), false);
  const c = PT.confirmVisit(v, { accessConfirmed: true });
  assert.equal(c.ok, true);
  assert.equal(PT.isConfirmedVisit(c.visit), true);
  assert.equal(PT.confirmVisit(v, { accessConfirmed: false }).ok, false);
});

test("accepted proposal values stay frozen after a later revision", () => {
  let p = PT.createProposal({ id: "p1", aluguel: 2400, prazoMeses: 30 });
  p = PT.reviseProposal(p, { aluguel: 2300 }).proposal;
  const acc = PT.acceptProposal(p);
  assert.equal(acc.ok, true);
  const rev = PT.reviseProposal(acc.proposal, { aluguel: 2100 });
  assert.equal(rev.proposal.versions.length, 3);
  assert.equal(PT.acceptedTerms(rev.proposal).aluguel, 2300);
  assert.equal(PT.acceptProposal(acc.proposal).ok, false, "accepts only once");
});

test("contract is active only with every signature valid", () => {
  const c = PT.startSignature({ id: "c1", signatories: ["morador", "proprietario"] });
  assert.equal(c.status, "assinatura_iniciada");
  assert.equal(PT.activateContract(c).ok, false);
  const one = PT.sign(c, "morador", true);
  assert.equal(PT.activateContract(one).ok, false);
  assert.equal(PT.activateContract(PT.sign(one, "proprietario", false)).ok, false);
  const act = PT.activateContract(PT.sign(one, "proprietario", true));
  assert.equal(act.ok, true);
  assert.equal(act.contract.status, "ativo");
});

test("replayed payment event creates no second repasse", () => {
  const ev = PT.signEvent({ id: "evt_1", kind: "pagamento", contractId: "c1", amount: 2400 });
  const l1 = PT.ingestPaymentEvent(PT.emptyLedger(), ev);
  assert.equal(l1.result, "aplicado");
  const l2 = PT.ingestPaymentEvent(l1.ledger, ev);
  assert.equal(l2.result, "duplicado");
  assert.equal(l2.ledger.repasses.length, 1);
  const l3 = PT.ingestPaymentEvent(l2.ledger, { ...ev, id: "evt_2", amount: 9999 });
  assert.equal(l3.result, "rejeitado");
  assert.equal(l3.ledger.repasses.length, 1);
});

test("repasse advances strictly in order and needs a reconciled payment", () => {
  const r = PT.newRepasse({ id: "r1", aluguel: 2400, tau: 0.1 });
  assert.equal(r.status, "previsto");
  assert.equal(r.liquido, 2160);
  assert.equal(PT.advanceRepasse(r, "autorizado").ok, false, "no skipping");
  assert.equal(PT.advanceRepasse(r, "conciliado", { payment: "informado" }).ok, false);
  const c = PT.advanceRepasse(r, "conciliado", { payment: "conciliado" });
  assert.equal(c.ok, true);
  const f = PT.advanceRepasse(PT.advanceRepasse(c.repasse, "autorizado").repasse, "confirmado");
  assert.equal(f.repasse.status, "confirmado");
  assert.equal(PT.advanceRepasse(f.repasse, "previsto").ok, false);
});

test("drafts stay out of public search", () => {
  const list = [{ id: "a", status: "publicado" }, { id: "b", status: "rascunho" }, { id: "c", status: "revisao" }, { id: "d", status: "pausado" }];
  assert.deepEqual(PT.publicListings(list).map((l) => l.id), ["a"]);
});

test("documents of another account are blocked", () => {
  const doc = { id: "d1", ownerAccount: "acc_dono_1", kind: "matricula" };
  assert.equal(PT.canAccessDocument({ role: "proprietario", account: "acc_dono_1" }, doc), true);
  assert.equal(PT.canAccessDocument({ role: "proprietario", account: "acc_dono_2" }, doc), false);
  assert.equal(PT.canAccessDocument({ role: "morador", account: "acc_m_1" }, doc), false);
  assert.equal(PT.canAccessDocument({ role: "equipe", account: "acc_eq", grants: ["d1"] }, doc), true);
  assert.equal(PT.canAccessDocument({ role: "equipe", account: "acc_eq", grants: [] }, doc), false);
});

test("exact address shows only after a confirmed visit or to owner/team", () => {
  const l = { id: "l1", ownerAccount: "acc_dono_1", bairro: "Bairro A", endereco: "Rua Fictícia, 10" };
  const m = { role: "morador", account: "acc_m_1" };
  assert.equal(PT.visibleAddress(l, m, []), "Bairro A");
  assert.equal(PT.visibleAddress(l, m, [{ listingId: "l1", account: "acc_m_1", status: "confirmada" }]), "Rua Fictícia, 10");
  assert.equal(PT.visibleAddress(l, m, [{ listingId: "l1", account: "acc_m_1", status: "solicitada" }]), "Bairro A");
  assert.equal(PT.visibleAddress(l, { role: "proprietario", account: "acc_dono_1" }, []), "Rua Fictícia, 10");
});

test("total monthly cost separates included and informed items", () => {
  const cost = PT.monthlyCost({ aluguel: 2400, condominio: 420, iptu: 80, seguro: 30 });
  assert.equal(cost.total, 2930);
  assert.deepEqual(cost.naoIncluidos, ["garantia", "consumo"]);
});
