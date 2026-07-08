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

  render();
})();
