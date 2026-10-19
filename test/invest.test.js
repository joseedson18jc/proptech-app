// Investing and valuation models ported from the interactive deck (Mini-AVM, simulator, Selic, checklist).
const test = require("node:test");
const assert = require("node:assert/strict");
const PT = require("../models.js");
const D = require("../data.js").PTData;

test("compound: 1.000 at 12% a.a. for 1 year with no deposits gives 1.120", () => {
  const r = PT.compound({ inicial: 1000, mensal: 0, yieldAA: 0.12, valAA: 0, anos: 1 });
  assert.equal(Math.round(r.final * 100) / 100, 1120);
});

test("compound: zero rate keeps only deposits and parts add up", () => {
  assert.equal(Math.round(PT.compound({ inicial: 0, mensal: 1000, yieldAA: 0, valAA: 0, anos: 3 }).final), 36000);
  const g = PT.compound({ inicial: 20000, mensal: 1000, yieldAA: 0.105, valAA: 0.015, anos: 20 });
  assert.equal(Math.round(g.aportado + g.juros), Math.round(g.final));
  assert.equal(g.aportado, 20000 + 1000 * 12 * 20);
  assert.equal(g.serie.length, 21);
});

test("fiiSpread: yield 10,5 vs Selic 14,75 is −4,25 gross and uses Selic × 0,85 net", () => {
  const s = PT.fiiSpread({ yieldFII: 10.5, selic: 14.75 });
  assert.equal(Math.round(s.bruto * 100) / 100, -4.25);
  assert.equal(Math.round(s.cdiLiquido * 10000) / 10000, 12.5375);
  assert.equal(Math.round(s.liquido * 10000) / 10000, -2.0375);
});

test("checklistScore counts unique known items", () => {
  const all = ["a", "b", "c"];
  assert.equal(PT.checklistScore([], all), 0);
  assert.equal(PT.checklistScore(["a", "a", "b", "zz"], all), 2);
  assert.equal(PT.checklistScore(all, all), 3);
});

test("avm: band contains central and bigger area lowers price per m²", () => {
  const a = PT.avm({ city: "ld", bairro: "A", tipo: "Apartamento", area: 70, conservacao: "normal" });
  assert.ok(a.min < a.central && a.central < a.max);
  assert.ok(PT.avm({ city: "ld", bairro: "A", tipo: "Apartamento", area: 140, conservacao: "normal" }).m2 < a.m2);
  assert.ok(PT.avm({ city: "ld", bairro: "A", tipo: "Apartamento", area: 70, conservacao: "reformado" }).central > a.central);
});

test("avm suggested rent is within ±20% of every published seed listing (Londrina)", () => {
  for (const l of PT.publicListings(D.LISTINGS)) {
    const v = PT.avm({ city: "ld", bairro: l.bairro, tipo: l.tipo, area: l.area, conservacao: "normal" });
    const ratio = v.aluguel.central / l.aluguel;
    assert.ok(ratio > 0.8 && ratio < 1.2, `${l.titulo}: ratio ${ratio.toFixed(2)}`);
  }
});
