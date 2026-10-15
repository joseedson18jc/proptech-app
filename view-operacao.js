/* Operação: next steps with owner and deadline, idempotent event queue, agenda capacity, KPIs, audit. */
(function (root) {
  "use strict";
  const { App, PT, PTData: D } = root;
  const esc = App.esc;
  const TEAM = D.VIEWERS.equipe;
  const LANES = [
    { id: "visitas", t: "Anúncios e visitas" },
    { id: "propostas", t: "Propostas" },
    { id: "contratos", t: "Contratos e vistoria" },
    { id: "repasses", t: "Repasses" },
    { id: "chamados", t: "Chamados" },
  ];

  function task({ lane, title, who, due, sev = "", mine = true, body = "" }) {
    return { lane, html: `<article class="task ${mine ? "mine" : ""} ${sev ? "sev-" + sev : ""}"><div class="t">${title}</div><div class="m"><span>${esc(who)}</span><span>·</span><span>${esc(due)}</span>${mine ? '<span class="pill info" style="margin-left:auto">ciclo piloto</span>' : ""}</div>${body}</article>` };
  }

  function liveTasks(s) {
    const out = [];
    s.listings.filter((l) => l.status === "revisao").forEach((l) => out.push(task({
      lane: "visitas", title: `Revisar anúncio · ${esc(l.titulo)}`, who: "Operação, corretagem", due: "hoje",
      body: `<button class="btn small" data-action="publish-listing" data-id="${l.id}">Conferir autorização e publicar</button>`,
    })));
    s.visits.filter((v) => v.status === "solicitada").forEach((v) => {
      const l = App.listing(s, v.listingId);
      const slot = s.slots.find((x) => x.id === v.slotId);
      out.push(task({
        lane: "visitas", sev: "warn", title: `Confirmar acesso · ${esc(l.titulo)}`, who: "Operação", due: slot ? `${App.day(slot.day)} ${slot.time}` : "—",
        body: `<label class="check" for="acc-${v.id}"><input type="checkbox" id="acc-${v.id}">Acesso confirmado com o responsável</label><button class="btn small primary" data-action="confirm-visit" data-id="${v.id}">Confirmar visita</button>`,
      }));
    });
    const p = s.proposal;
    if (p && p.acceptedVersion === null) {
      const l = App.listing(s, p.listingId);
      out.push(task({
        lane: "propostas", title: `Proposta v${p.versions.length} · ${esc(l.titulo)} aguarda proprietário`, who: "Proprietário decide", due: "48 h",
        body: `<div class="row"><button class="btn small" data-action="nav" data-view="dono">Abrir visão do proprietário</button></div>`,
      }));
    }
    if (p && p.acceptedVersion !== null && !s.contract) {
      out.push(task({ lane: "contratos", title: "Gerar contrato e iniciar assinatura", who: "Operação, jurídico", due: "hoje", body: `<button class="btn small primary" data-action="start-signature">Iniciar assinatura</button>` }));
    }
    const c = s.contract;
    if (c && c.status !== "ativo") {
      out.push(task({
        lane: "contratos", sev: "warn", title: "Validar assinaturas e ativar contrato", who: "Operação", due: "hoje",
        body: `<div class="row">${c.signatures.map((x) => `<span class="pill ${x.signed && x.valid ? "good" : x.signed ? "bad" : "dim"}">${x.who}</span>`).join("")}</div><button class="btn small primary" data-action="activate-contract">Ativar contrato</button>`,
      }));
    }
    if (c && c.status === "ativo" && !s.vistoria) {
      out.push(task({ lane: "contratos", title: "Registrar vistoria de entrada", who: "Operação de campo", due: "antes das chaves", body: `<button class="btn small primary" data-action="register-vistoria">Registrar vistoria (24 itens, 36 fotos)</button>` }));
    }
    const r = s.repasse;
    if (r && r.status !== "confirmado") {
      const next = PT.REPASSE_FLOW[PT.REPASSE_FLOW.indexOf(r.status) + 1];
      const label = next === "conciliado" ? "Conciliar com o extrato" : next === "autorizado" ? (r.review1 ? "2ª revisão e autorizar" : "1ª revisão") : "Confirmar repasse ao proprietário";
      out.push(task({
        lane: "repasses", sev: r.status === "previsto" ? "warn" : "", title: `Repasse ${App.brl(r.liquido)} · ${esc(r.status)}`, who: "Financeiro", due: "D+2 úteis",
        body: `<small class="muted">Pagamento: ${esc(s.payment)}</small><button class="btn small primary" data-action="advance-repasse">${label}</button>`,
      }));
    }
    if (r && r.status === "confirmado") out.push(task({ lane: "repasses", title: `1º repasse confirmado · ${App.brl(r.liquido)}`, who: "Financeiro", due: "concluído" }));
    return out;
  }

  function board(s) {
    const tasks = [...liveTasks(s), ...D.BACKLOG.map((b) => task({ lane: b.coluna, title: esc(b.titulo), who: b.responsavel, due: b.prazo, sev: b.sev === "info" ? "" : b.sev, mine: false }))];
    return `<div class="board">${LANES.map((ln) => {
      const items = tasks.filter((t) => t.lane === ln.id);
      return `<section class="lane" aria-label="${ln.t}"><div class="lane-head"><span class="eyebrow">${ln.t}</span><span class="mono muted" style="font-size:var(--t-xs)">${items.length}</span></div>${items.map((t) => t.html).join("")}</section>`;
    }).join("")}</div>`;
  }

  function consoleView(s) {
    const L = s.ledger;
    const dup = L.log.filter((x) => x.result === "duplicado").length;
    const rej = L.log.filter((x) => x.result === "rejeitado").length;
    const active = s.contract && s.contract.status === "ativo";
    return `<section class="panel stack" id="sec-eventos" aria-labelledby="ev">
      <div class="panel-head" style="margin:0"><div><span class="eyebrow">Fila e integrações</span><h2 id="ev" style="margin-top:6px">Eventos de pagamento</h2></div><span class="eyebrow">perda máx. 24 h · retorno 8 h</span></div>
      <div class="stat-row">
        <div class="stat"><span class="v">${L.log.length}</span><span class="k">eventos recebidos</span></div>
        <div class="stat"><span class="v">${L.repasses.length}</span><span class="k">efeitos financeiros</span></div>
        <div class="stat"><span class="v" style="color:var(--amber)">${dup}</span><span class="k">repetições ignoradas</span></div>
        <div class="stat"><span class="v" style="color:var(--bad)">${rej}</span><span class="k">assinatura inválida</span></div>
      </div>
      <div class="row">
        <button class="btn primary" data-action="webhook" data-kind="novo" ${active ? "" : "disabled"}>Receber pagamento do banco</button>
        <button class="btn" data-action="webhook" data-kind="repetido" ${s.payment === "conciliado" ? "" : "disabled"}>Reenviar o mesmo evento</button>
        <button class="btn danger" data-action="webhook" data-kind="adulterado" ${active ? "" : "disabled"}>Evento adulterado</button>
        ${active ? "" : '<span class="muted" style="font-size:var(--t-xs)">Disponível com contrato ativo.</span>'}
      </div>
      <div class="console" role="log" aria-label="Log de eventos">${s.consoleLog.slice().reverse().map((x) => `<div class="ln"><span class="ts">${esc(x.ts)}</span><span class="${x.result === "aplicado" ? "ok" : x.result === "duplicado" ? "dup" : "rej"}">${x.result.toUpperCase()}</span><span class="msg">${esc(x.text)}</span></div>`).join("")}</div>
      <small class="muted">Cada evento tem identificador único e assinatura conferida. Repetição não repete efeito financeiro; tentativas limitadas e falhas registradas.</small>
    </section>`;
  }

  const CAP_FIELDS = [
    ["D", "Dias úteis no mês", 10, 26, 1, (v) => v],
    ["s", "Janelas por dia", 1, 6, 1, (v) => v],
    ["b", "Profissionais de campo", 1, 8, 1, (v) => v],
    ["eta", "Tempo utilizável", 0.5, 1, 0.05, (v) => App.pct(v)],
    ["presence", "Presença", 0.4, 1, 0.05, (v) => App.pct(v)],
    ["proposal", "Visita → proposta", 0.05, 0.5, 0.01, (v) => App.pct(v)],
    ["activation", "Proposta → contrato", 0.1, 0.8, 0.05, (v) => App.pct(v)],
    ["target", "Meta de ativações/mês", 1, 30, 1, (v) => v],
  ];

  function capOut(s) {
    const c = s.cap;
    const r = PT.capacity(c);
    const need = PT.requiredSchedules(c.target, c);
    const staff = PT.requiredStaff(need, c.D * c.s * c.eta);
    const rows = [["Agendamentos", r.K], ["Presença", r.attended], ["Proposta", r.proposals], ["Ativação", r.activations]];
    return `<div class="formula">K = D × s × b × η = <b>${c.D} × ${c.s} × ${c.b} × ${App.num(c.eta, 2)} = ${App.num(r.K, 0)}</b> agendamentos/mês</div>
      <div class="funnel">${rows.map(([k, v]) => `<div class="bar"><span>${k}</span><div class="track"><div class="fill" style="width:${Math.max(2, (v / r.K) * 100)}%"></div></div><span class="mono r" style="text-align:right">${App.num(v, v < 10 ? 2 : 0)}</span></div>`).join("")}</div>
      <div class="callout ${staff > c.b ? "warn" : "good"}"><b>Para ${c.target} ativações/mês: ≈ ${need} agendamentos, ou ${staff} profissional${staff > 1 ? "is" : ""} de campo.</b>${staff > c.b ? `A equipe atual (${c.b}) não entrega essa agenda; limite a campanha ou amplie o campo.` : "A equipe atual cobre a meta com essa produtividade."}</div>`;
  }

  function capacityView(s) {
    return `<section class="panel stack" id="sec-capacidade" aria-labelledby="cap">
      <div class="panel-head" style="margin:0"><div><span class="eyebrow">Operação e capacidade · eq. (6) e (7)</span><h2 id="cap" style="margin-top:6px">A agenda precisa caber na equipe</h2></div><span class="pill warn">percentuais hipotéticos</span></div>
      <div class="grid cols-2">${CAP_FIELDS.map(([k, label, min, max, step, fmt]) => `<div class="field"><label for="cap-${k}">${label} <output id="capv-${k}">${fmt(s.cap[k])}</output></label><input type="range" id="cap-${k}" min="${min}" max="${max}" step="${step}" value="${s.cap[k]}" data-input="cap" data-k="${k}"></div>`).join("")}</div>
      <div id="capOut" class="stack">${capOut(s)}</div>
    </section>`;
  }

  function kpiView() {
    return `<section class="panel stack" aria-labelledby="kp"><div class="panel-head" style="margin:0"><h3 id="kp">Indicadores da semana</h3><span class="eyebrow">metas de gestão, não benchmarks</span></div>
      <div class="table-wrap"><table><thead><tr><th>Indicador</th><th>Meta</th><th class="r">Atual</th><th>Fórmula</th></tr></thead><tbody>
      ${D.KPIS.map((k) => {
        const val = k.moeda ? App.brl(k.valor) : App.pct(k.valor);
        const st = k.alvo === null ? "info" : k.valor >= k.alvo ? "good" : "warn";
        return `<tr><td><b>${k.k}</b></td><td class="mono">${k.meta}</td><td class="r"><span class="pill ${st}">${val}</span></td><td class="muted">${k.formula}</td></tr>`;
      }).join("")}</tbody></table></div>
      <div class="callout bad"><b>Tolerância zero</b>Pagamento duplicado e acesso indevido a documentos.</div></section>`;
  }

  function docsAudit(s) {
    return `<section class="panel stack"><div class="panel-head" style="margin:0"><h3>Documentos da equipe</h3><span class="eyebrow">acesso por concessão</span></div>
      ${D.DOCUMENTS.map((d) => PT.canAccessDocument(TEAM, d)
        ? `<div class="doc"><span>${esc(d.titulo)}</span><button class="btn small" data-action="open-doc">Abrir</button></div>`
        : `<div class="doc"><span>${esc(d.titulo)}</span><span class="row" style="gap:8px"><span class="lock">sem concessão</span><button class="btn small" data-action="request-access" data-id="${d.id}">Solicitar acesso</button></span></div>`).join("")}
      <hr class="rule"><div class="panel-head" style="margin:0"><h3>Auditoria</h3><span class="eyebrow">registro de ações</span></div>
      <div class="audit">${s.audit.map((a) => `<div><span class="muted">${esc(a.ts)}</span><span class="who">${esc(a.who)}</span><span>${esc(a.what)}</span></div>`).join("")}</div>
    </section>`;
  }

  function cycleStrip(s) {
    const c = App.cycle(s);
    const done = c.filter((x) => x.done).length;
    return `<section class="cycle" aria-label="Ciclo piloto">
      <div class="row" style="justify-content:space-between"><span class="eyebrow">Ciclo piloto · do anúncio ao 1º repasse conciliado</span><b>${done} de ${c.length}</b></div>
      <ol>${c.map((x) => `<li class="${x.done ? "done" : ""} ${x.now ? "now" : ""}"><i></i><span>${esc(x.full || x.k)}</span></li>`).join("")}</ol>
    </section>`;
  }

  App.views.operacao = {
    render(s) {
      return `<div class="view">
        <div class="view-head"><div><span class="eyebrow">Operação · ${esc(App.city(s).nome)}</span>
          <h1>Cada etapa precisa de uma conclusão.</h1>
          <p class="lede">A interface mostra o próximo passo; a operação registra como ele foi concluído, com responsável e prazo.</p></div>
          <div class="row"><button class="btn ghost small" data-action="reset">Reiniciar demonstração</button><span class="demo-note">contratos e chamados fictícios</span></div></div>
        ${cycleStrip(s)}
        ${board(s)}
        <div class="grid cols-2">${consoleView(s)}${capacityView(s)}</div>
        <div class="grid cols-2">${kpiView()}${docsAudit(s)}</div>
      </div>`;
    },
  };

  App.inputs.cap = (el) => {
    const k = el.dataset.k;
    const v = Number(el.value);
    App.set((s) => ({ cap: { ...s.cap, [k]: v } }), { render: false });
    const f = CAP_FIELDS.find((x) => x[0] === k);
    const o = document.getElementById("capv-" + k);
    if (o) o.textContent = f[5](v);
    const box = document.getElementById("capOut");
    if (box) box.innerHTML = capOut(App.state);
  };

  // ---------- Actions ----------
  App.actions["publish-listing"] = (el) => {
    const id = el.dataset.id;
    App.set((s) => ({ listings: s.listings.map((l) => (l.id === id ? { ...l, status: "publicado", verificado: { data: new Date().toISOString().slice(0, 10), evidencia: "Autorização conferida pela equipe" } } : l)), ...App.withAudit(s, "equipe", `Anúncio publicado após conferência · ${App.listing(s, id).titulo}.`) }));
    App.toast("Anúncio publicado com selo de verificação datado.", "good");
  };

  App.actions["confirm-visit"] = (el) => {
    const id = el.dataset.id;
    const box = document.getElementById("acc-" + id);
    const s = App.state;
    const v = s.visits.find((x) => x.id === id);
    const r = PT.confirmVisit(v, { accessConfirmed: Boolean(box && box.checked) });
    if (!r.ok) return App.toast(r.error, "bad");
    App.set((st) => ({ visits: st.visits.map((x) => (x.id === id ? r.visit : x)), ...App.withAudit(st, "equipe", `Visita confirmada · ${App.listing(st, v.listingId).titulo}.`) }));
    App.toast("Visita confirmada. Endereço liberado ao morador.", "good");
  };

  App.actions["start-signature"] = () => {
    App.set((s) => ({ contract: { ...PT.startSignature({ id: "c-" + s.proposal.id.slice(-4), signatories: ["morador", "proprietario"] }), tau: D.TAXA_ADM }, ...App.withAudit(s, "equipe", "Contrato gerado com os termos aceitos; assinatura iniciada.") }));
    App.toast("Assinatura iniciada. Ainda não é contrato concluído.", "warn");
  };

  App.actions["activate-contract"] = () => {
    const s = App.state;
    const r = PT.activateContract(s.contract);
    if (!r.ok) return App.toast(r.error, "bad");
    const terms = PT.acceptedTerms(s.proposal);
    App.set((st) => ({ contract: r.contract, repasse: PT.newRepasse({ id: "r-" + r.contract.id, aluguel: terms.aluguel, tau: r.contract.tau ?? D.TAXA_ADM }), ...App.withAudit(st, "equipe", "Contrato ativo com assinaturas válidas; repasse previsto criado.") }));
    App.toast("Contrato ativo. Repasse previsto criado.", "good");
  };

  App.actions["register-vistoria"] = () => {
    App.set((s) => ({ vistoria: { itens: 24, fotos: 36, data: new Date().toISOString().slice(0, 10) }, ...App.withAudit(s, "equipe", "Vistoria de entrada registrada: 24 itens, 36 fotos.") }));
    App.toast("Vistoria registrada. Chaves liberadas.", "good");
  };

  App.actions.webhook = (el) => {
    const s = App.state;
    const c = s.contract;
    const terms = PT.acceptedTerms(s.proposal);
    const ev = PT.signEvent({ id: `evt_${c.id}_01`, kind: "pagamento", contractId: c.id, amount: terms.aluguel });
    const sent = el.dataset.kind === "adulterado" ? { ...ev, id: `evt_${c.id}_x${Math.floor(Math.random() * 90 + 10)}`, amount: ev.amount * 10 } : ev;
    const r = PT.ingestPaymentEvent(s.ledger, sent);
    const line = { ts: App.time(), result: r.result, text: `${sent.id} · pagamento ${c.id} · ${App.brl(sent.amount)}${r.result === "duplicado" ? " · sem novo repasse" : r.result === "rejeitado" ? " · assinatura não confere" : ""}` };
    App.set((st) => ({
      ledger: r.ledger,
      consoleLog: [...st.consoleLog, line].slice(-60),
      payment: r.result === "aplicado" ? "conciliado" : st.payment,
      ...App.withAudit(st, "integração", `Evento ${sent.id}: ${r.result}.`),
    }));
    App.toast(r.result === "aplicado" ? "Pagamento recebido e conferido no extrato." : r.result === "duplicado" ? "Evento repetido ignorado: nenhum efeito financeiro novo." : "Evento rejeitado: assinatura inválida.", r.result === "aplicado" ? "good" : r.result === "duplicado" ? "warn" : "bad");
  };

  App.actions["advance-repasse"] = () => {
    const s = App.state;
    const r = s.repasse;
    const next = PT.REPASSE_FLOW[PT.REPASSE_FLOW.indexOf(r.status) + 1];
    if (next === "autorizado" && !r.review1) {
      App.set((st) => ({ repasse: { ...st.repasse, review1: true }, ...App.withAudit(st, "financeiro", "1ª revisão do repasse concluída.") }));
      return App.toast("1ª revisão registrada. A autorização exige uma 2ª revisão.", "warn");
    }
    const res = PT.advanceRepasse(r, next, { payment: s.payment });
    if (!res.ok) return App.toast(s.payment === "nenhum" && next === "conciliado" ? "Nenhum pagamento recebido ainda: não há o que conciliar." : res.error, "bad");
    App.set((st) => ({ repasse: res.repasse, ...App.withAudit(st, "financeiro", `Repasse ${next}.`) }));
    App.toast(`Repasse ${next}.`, "good");
  };

  App.actions["request-access"] = (el) => {
    const d = D.DOCUMENTS.find((x) => x.id === el.dataset.id);
    App.set((s) => App.withAudit(s, "equipe", `Solicitação de acesso registrada · ${d.titulo}. Aguarda titular.`));
    App.toast("Solicitação registrada. O acesso depende da concessão do titular.", "warn");
  };
})(typeof self !== "undefined" ? self : this);
