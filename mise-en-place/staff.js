/* ============================================================
   QENTINA — Mise en Place · espace salarié
   Affiche les checklists configurées par le responsable et
   mémorise l'avancement du jour (remis à zéro chaque matin).
   ============================================================ */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);

  /* 1) Récupère une éventuelle config transmise dans le lien */
  let updated = false;
  const m = location.hash.match(/cfg=([^&]+)/);
  if (m) {
    const cfg = MEP.decodeConfig(m[1]);
    if (cfg) {
      MEP.saveConfig(cfg);
      updated = true;
      // Nettoie l'URL pour ne pas retraiter le lien au rechargement
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  const config = MEP.loadConfig();
  const progress = MEP.loadProgress();

  $("#today").textContent = MEP.frenchDate();
  if (updated) {
    const n = $("#notice");
    n.hidden = false;
    n.textContent = "✅ Liste mise à jour par le responsable.";
  }

  function totals() {
    let done = 0, total = 0;
    config.postes.forEach((p) => p.items.forEach((it) => {
      total++;
      if (progress.checked[it.id]) done++;
    }));
    const h = haccpTotals();
    return { done: done + h.done, total: total + h.total };
  }

  /* Un relevé est « fait » s'il est conforme, ou hors seuil AVEC action corrective */
  function cellDone(cell, pt) {
    const st = MEP.haccpState(cell ? cell.v : "", pt);
    if (st === "ok") return true;
    if (st === "bad") return !!(cell && cell.action && cell.action.trim());
    return false;
  }
  function haccpTotals() {
    let done = 0, total = 0;
    config.haccp.moments.forEach((m) => config.haccp.points.forEach((pt) => {
      total++;
      const cell = (progress.haccp[m.id] || {})[pt.id];
      if (cellDone(cell, pt)) done++;
    }));
    return { done, total };
  }

  function renderHeader() {
    const { done, total } = totals();
    const pct = total ? Math.round((done / total) * 100) : 0;
    $("#progress-txt").textContent = done + " / " + total + " tâches réalisées";
    $("#progress-pct").textContent = pct + " %";
    $("#progress-bar").style.width = pct + "%";
  }

  function render() {
    const wrap = $("#stations");
    wrap.innerHTML = "";
    const hasItems = config.postes.some((p) => p.items.length);
    $("#empty").hidden = hasItems;

    config.postes.forEach((p) => {
      if (!p.items.length) return;
      const done = p.items.filter((it) => progress.checked[it.id]).length;
      const total = p.items.length;
      const card = document.createElement("div");
      card.className = "station";
      const rows = p.items.map((it) => {
        const checked = progress.checked[it.id] ? "checked" : "";
        return (
          '<label class="check">' +
          '<input type="checkbox" data-id="' + it.id + '" ' + checked + ">" +
          '<span class="check__box">✓</span>' +
          '<span class="check__lbl">' + MEP.escapeHtml(it.label) + "</span>" +
          "</label>"
        );
      }).join("");
      card.innerHTML =
        '<div class="station__head">' +
        '<span class="station__name">' + MEP.escapeHtml(p.icon) + " " + MEP.escapeHtml(p.name) + "</span>" +
        '<span class="station__count ' + (done === total ? "done" : "") + '">' + done + " / " + total + "</span>" +
        "</div>" + rows;
      wrap.appendChild(card);
    });

    wrap.querySelectorAll('input[type=checkbox]').forEach((cb) => {
      cb.addEventListener("change", () => {
        if (cb.checked) progress.checked[cb.dataset.id] = true;
        else delete progress.checked[cb.dataset.id];
        MEP.saveProgress(progress);
        render();
        renderHeader();
      });
    });
    renderHeader();
  }

  /* ==================== RELEVÉS HACCP ==================== */
  function cellOf(mId, pId) {
    if (!progress.haccp[mId]) progress.haccp[mId] = {};
    if (!progress.haccp[mId][pId]) progress.haccp[mId][pId] = { v: "", action: "" };
    return progress.haccp[mId][pId];
  }

  function renderHaccp() {
    const body = $("#haccp-body");
    body.innerHTML = "";
    const h = config.haccp;
    if (!h.points.length) {
      body.innerHTML = '<p class="empty">Aucun point de contrôle configuré.</p>';
      $("#haccp-status").textContent = "";
      return;
    }
    h.moments.forEach((m) => {
      const block = document.createElement("div");
      block.className = "hc-moment";
      const cards = h.points.map((pt) => {
        const cell = cellOf(m.id, pt.id);
        const st = MEP.haccpState(cell.v, pt);
        const badge = st === "ok" ? "✓ Conforme" : st === "bad" ? "⚠ Hors seuil" : "À relever";
        return (
          '<div class="hc-point hc-' + st + '" data-m="' + m.id + '" data-p="' + pt.id + '">' +
            '<div class="hc-point__top">' +
              '<span class="hc-name">' + MEP.escapeHtml(pt.name) + "</span>" +
              '<span class="hc-range">' + fmtRange(pt) + "</span>" +
            "</div>" +
            '<div class="hc-point__row">' +
              '<input type="number" step="0.1" inputmode="decimal" class="hc-temp" placeholder="°C" value="' + attr(cell.v) + '" />' +
              '<span class="hc-badge">' + badge + "</span>" +
            "</div>" +
            '<input type="text" class="hc-action" placeholder="Action corrective (obligatoire)" value="' + attr(cell.action || "") + '" />' +
          "</div>"
        );
      }).join("");
      block.innerHTML =
        '<h3 class="hc-moment__name">' + MEP.escapeHtml(m.name) + "</h3>" +
        '<div class="hc-grid">' + cards + "</div>";
      body.appendChild(block);
    });

    body.querySelectorAll(".hc-point").forEach((el) => {
      const mId = el.dataset.m, pId = el.dataset.p;
      const pt = config.haccp.points.find((x) => x.id === pId);
      const temp = el.querySelector(".hc-temp");
      const action = el.querySelector(".hc-action");
      temp.addEventListener("input", () => {
        cellOf(mId, pId).v = temp.value;
        refreshCell(el, mId, pId, pt);
        persistHaccp();
      });
      action.addEventListener("input", () => {
        cellOf(mId, pId).action = action.value;
        refreshCell(el, mId, pId, pt);
        persistHaccp();
      });
    });
    renderHaccpStatus();
  }

  /* Met à jour l'état visuel d'une carte sans re-render (garde le focus) */
  function refreshCell(el, mId, pId, pt) {
    const cell = cellOf(mId, pId);
    const st = MEP.haccpState(cell.v, pt);
    el.classList.remove("hc-ok", "hc-bad", "hc-empty");
    el.classList.add("hc-" + st);
    el.querySelector(".hc-badge").textContent =
      st === "ok" ? "✓ Conforme" : st === "bad" ? "⚠ Hors seuil" : "À relever";
    renderHaccpStatus();
    renderHeader();
  }

  function renderHaccpStatus() {
    const { done, total } = haccpTotals();
    const el = $("#haccp-status");
    if (done >= total) { el.textContent = "✓ Complet"; el.className = "haccp__status ok"; }
    else { el.textContent = done + " / " + total + " relevés"; el.className = "haccp__status todo"; }
  }

  function persistHaccp() {
    MEP.saveProgress(progress);
    MEP.recordHaccpDay(config, progress);   // trace le jour dans le journal
  }

  function fmtRange(pt) {
    if (pt.min <= -18) return "≤ " + pt.max + " °C";
    return pt.min + " – " + pt.max + " °C";
  }
  function attr(s) { return String(s == null ? "" : s).replace(/"/g, "&quot;"); }

  /* ----- Exports (traçabilité) ----- */
  function dayText() {
    const lines = ["Relevés de température HACCP — QENTINA", MEP.frenchDate(), ""];
    config.haccp.moments.forEach((m) => {
      lines.push("— " + m.name + " —");
      config.haccp.points.forEach((pt) => {
        const cell = (progress.haccp[m.id] || {})[pt.id] || { v: "" };
        const st = MEP.haccpState(cell.v, pt);
        const val = cell.v === "" ? "non relevé" : cell.v + " °C";
        let line = "  • " + pt.name + " : " + val;
        if (st === "ok") line += " ✅ conforme";
        else if (st === "bad") line += " ⚠️ HORS SEUIL (" + fmtRange(pt) + ")" + (cell.action ? " → " + cell.action : "");
        lines.push(line);
      });
      lines.push("");
    });
    return lines.join("\n");
  }

  function download(name, content, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  $("#haccp-copy").addEventListener("click", async () => {
    const txt = dayText();
    try { await navigator.clipboard.writeText(txt); flash("#haccp-copy", "Copié ✅"); }
    catch (e) { download("releve-haccp-jour.txt", txt, "text/plain"); flash("#haccp-copy", "Téléchargé ✅"); }
  });
  $("#haccp-csv").addEventListener("click", () => {
    download("qentina-haccp-historique.csv", MEP.haccpCsv(), "text/csv;charset=utf-8");
    flash("#haccp-csv", "CSV téléchargé ✅");
  });

  function flash(sel, msg) {
    const el = $(sel); const old = el.textContent;
    el.textContent = msg;
    setTimeout(() => { el.textContent = old; }, 2500);
  }

  render();
  renderHaccp();
})();
