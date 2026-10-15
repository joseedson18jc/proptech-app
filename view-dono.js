/* Proprietário: monthly payout after reconciliation, proposals to decide, listing lifecycle, documents. */
(function (root) {
  "use strict";
  const { App, PT, PTData: D } = root;
  const esc = App.esc;
  const LABEL = { rascunho: "Rascunho", revisao: "Revisão", publicado: "Publicado", pausado: "Pausado" };

  function repasseView(s, viewer) {
    const fl = App.flowListing(s);
    const owned = fl && fl.ownerAccount === viewer.account;
    const r = owned ? s.repasse : null;
    const accepted = s.proposal && PT.acceptedTerms(s.proposal);
    const base = r || PT.newRepasse({ id: "estimativa", aluguel: accepted ? accepted.aluguel : (fl ? fl.aluguel : 2400), tau: D.TAXA_ADM });
    const idx = r ? PT.REPASSE_FLOW.indexOf(r.status) : -1;
    return `<section class="panel stack" aria-labelledby="rp">
      <div class="panel-head" style="margin:0"><div><span class="eyebrow">Repasse do mês</span><h2 id="rp" style="margin-top:6px">${r ? "Contrato em vigor" : "Estimativa"}</h2></div>
        ${r ? `<span class="pill ${r.status === "confirmado" ? "good" : r.status === "previsto" ? "dim" : "info"}">${esc(r.status)}</span>` : '<span class="pill dim">sem contrato ativo</span>'}</div>
      <div class="stat"><span class="v big">${App.brl(base.liquido)}</span><span class="k">${r && r.status !== "previsto" ? "após conciliação" : "previsto, sujeito à conciliação"}</span></div>
      <table class="cost-table"><tbody>
        <tr><td>Aluguel</td><td>${App.brl(base.aluguel)}</td></tr>
        <tr><td>Taxa de administração (${App.pct(base.taxa / base.aluguel, 1)})</td><td>−${App.brl(base.taxa)}</td></tr>
        <tr class="total"><td>Líquido ao proprietário</td><td>${App.brl(base.liquido)}</td></tr>
      </tbody></table>
      <div class="stepper" aria-label="Estados do repasse">${PT.REPASSE_FLOW.map((st, i) => `<div class="${i <= idx ? "done" : ""} ${i === idx + 1 && r ? "now" : ""}">${st}</div>`).join("")}</div>
      <div class="row"><button class="btn" data-action="download-statement" ${App.downloads ? "" : "hidden"}>Baixar demonstrativo (CSV)</button>
        <span class="muted" style="font-size:var(--t-xs)">Recursos do proprietário ficam segregados da receita própria.</span></div>
    </section>`;
  }

  function proposalsView(s, viewer) {
    const p = s.proposal;
    const l = p && App.listing(s, p.listingId);
    if (!p || !l || l.ownerAccount !== viewer.account) {
      return `<section class="panel stack"><div class="panel-head" style="margin:0"><h3>Propostas recebidas</h3><span class="eyebrow">decisão humana</span></div><div class="empty">Nenhuma proposta aguardando você. Propostas chegam depois de uma visita confirmada.</div></section>`;
    }
    const last = p.versions[p.versions.length - 1];
    const c = s.contract;
    const mine = c && c.signatures.find((x) => x.who === "proprietario");
    return `<section class="panel stack"><div class="panel-head" style="margin:0"><h3>Propostas recebidas</h3><span class="eyebrow">decisão humana</span></div>
      <div class="callout"><b>${esc(l.titulo)} · v${last.v}</b>${App.brl(last.aluguel)} por mês · ${last.prazoMeses} meses · anúncio pede ${App.brl(l.aluguel)}</div>
      <div class="versions">${p.versions.slice().reverse().map((v) => `<div class="ver ${p.acceptedVersion === v.v ? "acc" : ""}"><span class="mono">v${v.v}</span><span>${App.brl(v.aluguel)} · ${v.prazoMeses} meses</span><span class="pill ${p.acceptedVersion === v.v ? "good" : p.acceptedVersion !== null ? "dim" : "warn"}">${p.acceptedVersion === v.v ? "aceita" : p.acceptedVersion !== null ? "contraproposta" : "aguarda"}</span></div>`).join("")}</div>
      ${p.acceptedVersion === null ? `<div class="row"><button class="btn primary" data-action="accept-proposal">Aceitar v${last.v}</button><span class="muted" style="font-size:var(--t-xs)">Ao aceitar, os valores ficam congelados.</span></div>` : ""}
      ${c ? `<hr class="rule"><div class="panel-head" style="margin:0"><h3>Contrato</h3><span class="pill ${c.status === "ativo" ? "good" : "warn"}">${c.status === "ativo" ? "ativo" : "assinatura iniciada"}</span></div>
        ${c.status !== "ativo" && !(mine.signed && mine.valid) ? `<div class="row"><button class="btn primary" data-action="sign-owner" data-valid="1">Assinar pelo provedor</button><button class="btn ghost small" data-action="sign-owner" data-valid="0">Simular certificado inválido</button></div>` : `<span class="muted" style="font-size:var(--t-sm)">Sua assinatura: ${mine.signed ? (mine.valid ? "válida" : "inválida, assine de novo") : "pendente"}.</span>`}` : ""}
    </section>`;
  }

  function listingsView(s, viewer) {
    const mine = s.listings.filter((l) => l.ownerAccount === viewer.account);
    return `<section class="panel stack"><div class="panel-head" style="margin:0"><h3>Seus anúncios</h3><span class="eyebrow">rascunho fica fora da busca pública</span></div>
      ${mine.map((l) => {
        const pub = l.status === "publicado";
        const act = l.status === "rascunho" ? `<button class="btn small" data-action="listing-status" data-id="${l.id}" data-to="revisao">Enviar para revisão</button>`
          : l.status === "revisao" ? `<span class="muted" style="font-size:var(--t-xs)">Aguarda revisão da equipe</span>`
          : l.status === "publicado" ? `<button class="btn small" data-action="listing-status" data-id="${l.id}" data-to="pausado">Pausar</button>`
          : `<button class="btn small" data-action="listing-status" data-id="${l.id}" data-to="publicado">Retomar</button>`;
        return `<div class="doc" style="align-items:start"><div class="stack" style="gap:6px"><b>${esc(l.titulo)}</b>
          <div class="lifecycle">${PT.LISTING_FLOW.map((st) => `<span class="${l.status === st ? "on" : ""}">${LABEL[st]}</span>`).join("")}</div>
          <small class="muted">${pub ? "Visível na busca pública" : "Fora da busca pública"} · Bairro ${l.bairro} · ${App.brl(PT.monthlyCost(l).total)}/mês</small></div>${act}</div>`;
      }).join("") || '<div class="empty">Nenhum anúncio nesta conta.</div>'}
    </section>`;
  }

  function docsView(viewer) {
    return `<section class="panel stack"><div class="panel-head" style="margin:0"><h3>Documentos</h3><span class="eyebrow">acesso controlado</span></div>
      ${D.DOCUMENTS.map((d) => {
        const ok = PT.canAccessDocument(viewer, d);
        return `<div class="doc"><span>${esc(d.titulo)}</span>${ok ? '<button class="btn small" data-action="open-doc">Abrir</button>' : '<span class="lock">bloqueado · documento de outra conta</span>'}</div>`;
      }).join("")}
    </section>`;
  }

  // ---------- Mini-AVM: display only; never writes to listings, contracts or payouts ----------
  const CONS = { reformar: "Precisa de reforma", normal: "Normal", reformado: "Reformado" };
  function avmOut(s) {
    const a = s.avmIn;
    const v = PT.avm({ city: s.city, ...a });
    const span = (x, y) => App.money(x) + " – " + App.money(y);
    return `<div class="avm-result">
        <div class="stat"><span class="k">faixa estimada de venda</span><span class="v">${span(v.min, v.max)}</span></div>
        <div class="avm-band" aria-hidden="true"><i style="left:${50 - (v.band / 0.3) * 50}%;right:${50 - (v.band / 0.3) * 50}%"></i><b></b></div>
        <div class="stat-row">
          <div class="stat"><span class="v">${App.money(v.central)}</span><span class="k">valor central</span></div>
          <div class="stat"><span class="v">${App.brl(v.m2)}</span><span class="k">por m²</span></div>
          <div class="stat"><span class="v" style="color:var(--accent)">${App.brl(Math.round(v.aluguel.central / 10) * 10)}</span><span class="k">aluguel sugerido · ${App.brl(Math.round(v.aluguel.min / 10) * 10)} a ${App.brl(Math.round(v.aluguel.max / 10) * 10)}</span></div>
        </div></div>`;
  }
  function avmView(s) {
    const a = s.avmIn;
    const mine = s.listings.filter((l) => l.ownerAccount === App.ownerViewer(s).account);
    return `<section class="panel stack" aria-labelledby="h-avm">
      <div class="panel-head"><div><span class="eyebrow">Mini-AVM · precificação automática</span><h2 id="h-avm">Quanto vale, quanto alugar</h2></div><span class="pill warn">estimativa didática</span></div>
      <div class="split">
        <div class="stack">
          <div class="grid cols-2">
            <div class="field"><label for="avm-bairro">Bairro</label><select class="input" id="avm-bairro" data-input="avm" data-k="bairro">${D.BAIRROS.map((b) => `<option value="${b.id}" ${a.bairro === b.id ? "selected" : ""}>${b.nome}</option>`).join("")}</select></div>
            <div class="field"><label for="avm-tipo">Tipologia</label><select class="input" id="avm-tipo" data-input="avm" data-k="tipo">${Object.keys(PT.AVM_TIPO).map((t) => `<option ${a.tipo === t ? "selected" : ""}>${t}</option>`).join("")}</select></div>
          </div>
          <div class="field"><label for="avm-area">Área útil <output id="avmv-area">${a.area} m²</output></label><input type="range" id="avm-area" min="20" max="250" step="1" value="${a.area}" data-input="avm" data-k="area"></div>
          <div class="field"><span class="lab">Conservação</span><div class="seg" role="group" aria-label="Conservação">${Object.entries(CONS).map(([k, t]) => `<button data-action="avm-cons" data-c="${k}" aria-pressed="${a.conservacao === k}">${t}</button>`).join("")}</div></div>
          ${mine.length ? `<div class="row"><span class="hint">Usar dados de:</span>${mine.map((l) => `<button class="chip" data-action="avm-from" data-id="${l.id}">${esc(l.titulo)}</button>`).join("")}</div>` : ""}
        </div>
        <div class="stack"><div id="avm-out">${avmOut(s)}</div>
          <p class="hint">Comparáveis fictícios por bairro, tipologia, área e conservação, em ${esc(App.city(s).nome)}. O resultado não altera anúncios, contratos nem repasses.</p></div>
      </div>
    </section>`;
  }
  const refreshAvm = () => { const b = document.getElementById("avm-out"); if (b) b.innerHTML = avmOut(App.state); };
  App.inputs.avm = (el) => {
    const k = el.dataset.k;
    const allowed = { bairro: (v) => D.BAIRROS.some((b) => b.id === v), tipo: (v) => v in PT.AVM_TIPO, area: (v) => v >= 20 && v <= 250 };
    const v = k === "area" ? Number(el.value) : el.value;
    if (!allowed[k] || !allowed[k](v)) return;
    App.set((s) => ({ avmIn: { ...s.avmIn, [k]: v } }), { render: false });
    if (k === "area") document.getElementById("avmv-area").textContent = v + " m²";
    refreshAvm();
  };
  App.actions["avm-cons"] = (el) => {
    App.set((s) => ({ avmIn: { ...s.avmIn, conservacao: el.dataset.c } }), { render: false });
    document.querySelectorAll('[data-action="avm-cons"]').forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.c === el.dataset.c)));
    refreshAvm();
  };
  App.actions["avm-from"] = (el) => {
    const l = App.listing(App.state, el.dataset.id);
    if (l) App.set((s) => ({ avmIn: { ...s.avmIn, bairro: l.bairro, tipo: l.tipo in PT.AVM_TIPO ? l.tipo : "Apartamento", area: l.area } }));
  };

  App.views.dono = {
    render(s) {
      const viewer = App.ownerViewer(s);
      const fl = App.flowListing(s);
      return `<div class="view">
        <div class="view-head"><div><span class="eyebrow">Visão do proprietário · ${fl ? "proprietário de " + esc(fl.titulo) : "conta demo"}</span>
          <h1>Seu imóvel, seu repasse, com evidência.</h1>
          <p class="lede">O repasse só aparece como recebido depois da conciliação. ${fl ? "Você é o proprietário de " + esc(fl.titulo) + ", em negociação." : "Abra um imóvel na visão do morador para iniciar o ciclo."}</p></div>
          <span class="demo-note">valores fictícios</span></div>
        <div class="grid cols-2">${repasseView(s, viewer)}${proposalsView(s, viewer)}</div>
        ${avmView(s)}
        <div class="grid cols-2">${listingsView(s, viewer)}${docsView(viewer)}</div>
      </div>`;
    },
  };

  App.acceptProposal = (who) => {
    const s = App.state;
    const r = PT.acceptProposal(s.proposal);
    if (!r.ok) return App.toast(r.error, "warn");
    const l = App.listing(s, s.proposal.listingId);
    App.set((st) => ({ proposal: r.proposal, ...App.withAudit(st, who, `Proposta v${r.proposal.acceptedVersion} aceita · ${l.titulo}.`) }));
    App.toast(`Proposta v${r.proposal.acceptedVersion} aceita. Valores congelados.`, "good");
  };
  App.actions["accept-proposal"] = () => App.acceptProposal("proprietário");

  App.actions["sign-owner"] = (el) => {
    const valid = el.dataset.valid === "1";
    App.set((s) => ({ contract: PT.sign(s.contract, "proprietario", valid), ...App.withAudit(s, "proprietário", valid ? "Assinatura do proprietário recebida." : "Assinatura do proprietário com certificado inválido.") }));
    App.toast(valid ? "Assinatura registrada." : "Certificado inválido: o contrato não pode ser ativado.", valid ? "good" : "bad");
  };

  App.actions["listing-status"] = (el) => {
    const { id, to } = el.dataset;
    App.set((s) => {
      const l = App.listing(s, id);
      return { listings: s.listings.map((x) => (x.id === id ? { ...x, status: to } : x)), ...App.withAudit(s, "proprietário", `${l.titulo}: ${LABEL[l.status]} → ${LABEL[to]}.`) };
    });
    App.toast(to === "pausado" ? "Anúncio pausado e retirado da busca." : to === "revisao" ? "Enviado para revisão da equipe." : "Anúncio de volta à busca.", "good");
  };

  App.actions["open-doc"] = () => App.toast("Documento aberto em ambiente privado (demonstração).", "good");

  App.actions["download-statement"] = async () => {
    const s = App.state;
    const fl = App.flowListing(s);
    const accepted = s.proposal && PT.acceptedTerms(s.proposal);
    const r = s.repasse || PT.newRepasse({ id: "estimativa", aluguel: accepted ? accepted.aluguel : (fl ? fl.aluguel : 2400), tau: D.TAXA_ADM });
    const csv = [
      "item;valor_brl",
      `imovel;${fl ? fl.titulo : "estimativa"}`,
      `aluguel;${r.aluguel.toFixed(2)}`,
      `taxa_administracao;-${r.taxa.toFixed(2)}`,
      `liquido;${r.liquido.toFixed(2)}`,
      `status;${s.repasse ? r.status : "estimativa"}`,
      "observacao;dados ficticios de demonstracao",
    ].join("\n");
    try {
      await App.downloads.save({ filename: "demonstrativo-repasse.csv", data: csv });
      App.toast("Demonstrativo salvo.", "good");
    } catch (e) {
      if (e && e.code === "declined") return;
      App.toast("Não foi possível salvar o arquivo nesta visualização.", "bad");
    }
  };
})(typeof self !== "undefined" ? self : this);
