/* ============================================================
   QENTINA — Mise en Place · espace responsable (admin)
   - Éditeur des postes et de leurs tâches
   - Génération du lien à transmettre au salarié
   - Gestion (locale au responsable) des stocks et des tâches

   ⚠️ Le code d'accès ci-dessous n'est qu'une protection LÉGÈRE,
   côté navigateur : le site étant public, un utilisateur
   technique pourrait la contourner. Le vrai garde-fou est de ne
   PAS communiquer l'adresse de cette page (admin.html) au
   salarié — lui n'a besoin que du lien « index.html ».
   Changez le code ci-dessous pour le vôtre.
   ============================================================ */
(function () {
  "use strict";
  const ADMIN_PASSCODE = "qentina";  // 👈 à personnaliser

  const $ = (s) => document.querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ==================== VERROU D'ACCÈS ==================== */
  const gate = $("#gate");
  const app = $("#app");
  function unlock() { gate.hidden = true; app.hidden = false; init(); }
  if (sessionStorage.getItem("qentina.mep.admin") === "1") {
    unlock();
  }
  $("#gate-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if ($("#gate-code").value === ADMIN_PASSCODE) {
      sessionStorage.setItem("qentina.mep.admin", "1");
      unlock();
    } else {
      $("#gate-err").hidden = false;
      $("#gate-code").value = "";
    }
  });

  /* ==================== INITIALISATION ==================== */
  let config, stock, tasks;
  function init() {
    config = MEP.loadConfig();
    stock = loadJSON("qentina.mep.stock", seedStock());
    tasks = loadJSON("qentina.mep.tasks", []);

    // Navigation par onglets
    $$(".tab").forEach((tab) => tab.addEventListener("click", () => {
      $$(".tab").forEach((t) => t.classList.remove("is-active"));
      $$(".view").forEach((v) => v.classList.remove("is-active"));
      tab.classList.add("is-active");
      $("#view-" + tab.dataset.view).classList.add("is-active");
    }));

    renderEditor();
    renderStock();
    renderTasks();
    wireShare();
    wireStockModal();
    wireTasks();
  }

  /* ==================== ÉDITEUR DE POSTES ==================== */
  function renderEditor() {
    const root = $("#editor");
    root.innerHTML = "";
    config.postes.forEach((p, pi) => {
      const card = document.createElement("div");
      card.className = "ed-poste";
      const items = p.items.map((it, ii) =>
        '<div class="ed-item">' +
          '<input type="text" class="ed-item-input" data-p="' + pi + '" data-i="' + ii + '" value="' + attr(it.label) + '" placeholder="Décrire la tâche…" />' +
          '<button class="icon-btn" data-act="item-up"   data-p="' + pi + '" data-i="' + ii + '" title="Monter">↑</button>' +
          '<button class="icon-btn" data-act="item-down" data-p="' + pi + '" data-i="' + ii + '" title="Descendre">↓</button>' +
          '<button class="icon-btn" data-act="item-del"  data-p="' + pi + '" data-i="' + ii + '" title="Supprimer">🗑</button>' +
        "</div>"
      ).join("");
      card.innerHTML =
        '<div class="ed-poste-head">' +
          '<input type="text" class="ed-icon" data-act="poste-icon" data-p="' + pi + '" value="' + attr(p.icon) + '" maxlength="2" aria-label="Icône" />' +
          '<input type="text" class="ed-name" data-act="poste-name" data-p="' + pi + '" value="' + attr(p.name) + '" placeholder="Nom du poste" />' +
          '<button class="icon-btn" data-act="poste-up"   data-p="' + pi + '" title="Monter le poste">↑</button>' +
          '<button class="icon-btn" data-act="poste-down" data-p="' + pi + '" title="Descendre le poste">↓</button>' +
          '<button class="icon-btn" data-act="poste-del"  data-p="' + pi + '" title="Supprimer le poste">🗑</button>' +
        "</div>" +
        '<div class="ed-items">' + items + "</div>" +
        '<div class="ed-add"><input type="text" class="ed-new" data-p="' + pi + '" placeholder="Ajouter une tâche puis Entrée" />' +
          '<button class="btn btn--ghost" data-act="item-add" data-p="' + pi + '">+ Tâche</button></div>';
      root.appendChild(card);
    });
    wireEditor();
  }

  function wireEditor() {
    // Édition de texte (sans re-rendu, pour conserver le focus)
    $$(".ed-item-input").forEach((el) => el.addEventListener("input", () => {
      config.postes[+el.dataset.p].items[+el.dataset.i].label = el.value;
      MEP.saveConfig(config); refreshLink();
    }));
    $$('[data-act="poste-name"]').forEach((el) => el.addEventListener("input", () => {
      config.postes[+el.dataset.p].name = el.value; MEP.saveConfig(config); refreshLink();
    }));
    $$('[data-act="poste-icon"]').forEach((el) => el.addEventListener("input", () => {
      config.postes[+el.dataset.p].icon = el.value || "📋"; MEP.saveConfig(config); refreshLink();
    }));

    // Ajout de tâche (bouton + touche Entrée)
    $$('[data-act="item-add"]').forEach((el) => el.addEventListener("click", () => addItem(+el.dataset.p)));
    $$(".ed-new").forEach((el) => el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); addItem(+el.dataset.p); }
    }));

    // Actions structurelles
    $$('#editor [data-act]').forEach((btn) => {
      const act = btn.dataset.act;
      if (["poste-name", "poste-icon", "item-add"].includes(act)) return;
      btn.addEventListener("click", () => {
        const pi = +btn.dataset.p, ii = +btn.dataset.i;
        if (act === "item-up") move(config.postes[pi].items, ii, -1);
        else if (act === "item-down") move(config.postes[pi].items, ii, 1);
        else if (act === "item-del") config.postes[pi].items.splice(ii, 1);
        else if (act === "poste-up") move(config.postes, pi, -1);
        else if (act === "poste-down") move(config.postes, pi, 1);
        else if (act === "poste-del") {
          if (!confirm("Supprimer le poste « " + config.postes[pi].name + " » ?")) return;
          config.postes.splice(pi, 1);
        }
        MEP.saveConfig(config); renderEditor(); refreshLink();
      });
    });
  }

  function addItem(pi) {
    const input = document.querySelector('.ed-new[data-p="' + pi + '"]');
    const label = (input.value || "").trim() || "Nouvelle tâche";
    config.postes[pi].items.push({ id: MEP.uid("it"), label: label });
    MEP.saveConfig(config); renderEditor(); refreshLink();
    // Focus sur le champ « nouvelle tâche » du même poste pour enchaîner
    const again = document.querySelector('.ed-new[data-p="' + pi + '"]');
    if (again) again.focus();
  }

  function move(arr, i, dir) {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }

  $("#add-poste").addEventListener("click", () => {
    config.postes.push({ id: MEP.uid("p"), name: "Nouveau poste", icon: "📋", items: [] });
    MEP.saveConfig(config); renderEditor(); refreshLink();
  });
  $("#reset-default").addEventListener("click", () => {
    if (!confirm("Remplacer tous les postes par la configuration par défaut ?")) return;
    config = MEP.defaultConfig();
    MEP.saveConfig(config); renderEditor(); refreshLink();
  });

  /* ==================== LIEN SALARIÉ ==================== */
  function wireShare() {
    refreshLink();
    $("#copy-link").addEventListener("click", async () => {
      const link = MEP.buildStaffLink(config);
      let ok = false;
      try { await navigator.clipboard.writeText(link); ok = true; } catch (e) { /* fallback */ }
      const field = $("#link-field");
      field.hidden = false; field.value = link;
      if (!ok) { field.focus(); field.select(); }
      const done = $("#copy-ok");
      done.hidden = false;
      done.textContent = ok ? "Lien copié ✅" : "Copiez le lien ci-dessus 👇";
      setTimeout(() => { done.hidden = true; }, 4000);
    });
  }
  function refreshLink() {
    const field = $("#link-field");
    if (field && !field.hidden) field.value = MEP.buildStaffLink(config);
  }

  /* ==================== STOCKS (local responsable) ==================== */
  function seedStock() {
    return [
      { name: "Farine type 00", cat: "Farine & pâtes", qty: 25, unit: "kg", min: 10 },
      { name: "Mozzarella fior di latte", cat: "Fromages", qty: 8, unit: "kg", min: 5 },
      { name: "Sauce tomate San Marzano", cat: "Sauces & conserves", qty: 12, unit: "boîtes", min: 6 },
      { name: "Huile d'olive", cat: "Épicerie", qty: 4, unit: "L", min: 3 },
      { name: "Jambon / charcuterie", cat: "Charcuterie", qty: 3, unit: "kg", min: 4 },
      { name: "Boîtes à pizza", cat: "Consommables", qty: 40, unit: "u", min: 50 },
    ].map((s, i) => ({ id: "s" + i, ...s }));
  }
  function stockState(it) { return it.qty <= 0 ? "out" : it.qty < it.min ? "low" : "ok"; }
  function stepFor(it) { return it.unit === "u" || it.unit === "boîtes" ? 1 : 0.5; }

  function renderStock() {
    const body = $("#stock-body");
    body.innerHTML = "";
    const list = stock.slice().sort((a, b) => a.name.localeCompare(b.name, "fr"));
    $("#stock-empty").hidden = list.length > 0;
    list.forEach((it) => {
      const st = stockState(it);
      const label = st === "out" ? "Rupture" : st === "low" ? "Bas" : "OK";
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="name">' + MEP.escapeHtml(it.name) + "</td>" +
        '<td><span class="tag">' + MEP.escapeHtml(it.cat) + "</span></td>" +
        '<td class="num"><span class="qty-cell">' +
          '<button class="qty-btn" data-act="minus" data-id="' + it.id + '">−</button>' +
          "<span>" + fmt(it.qty) + " " + MEP.escapeHtml(it.unit) + "</span>" +
          '<button class="qty-btn" data-act="plus" data-id="' + it.id + '">+</button></span></td>' +
        '<td class="num">' + fmt(it.min) + " " + MEP.escapeHtml(it.unit) + "</td>" +
        '<td><span class="state state--' + st + '">' + label + "</span></td>" +
        '<td><div class="row-actions">' +
          '<button class="icon-btn" data-act="edit" data-id="' + it.id + '">✎</button>' +
          '<button class="icon-btn" data-act="del" data-id="' + it.id + '">🗑</button></div></td>';
      body.appendChild(tr);
    });
    $$("#stock-body [data-act]").forEach((b) => b.addEventListener("click", () => stockAction(b.dataset.act, b.dataset.id)));
  }
  function stockAction(act, id) {
    const it = stock.find((s) => s.id === id);
    if (!it) return;
    if (act === "plus") it.qty = round(it.qty + stepFor(it));
    else if (act === "minus") it.qty = Math.max(0, round(it.qty - stepFor(it)));
    else if (act === "del") { if (!confirm("Supprimer « " + it.name + " » ?")) return; stock = stock.filter((s) => s.id !== id); }
    else if (act === "edit") { openModal(it); return; }
    saveJSON("qentina.mep.stock", stock); renderStock();
  }

  let editingId = null;
  const modal = $("#modal");
  function openModal(it) {
    editingId = it ? it.id : null;
    $("#modal-title").textContent = it ? "Modifier l'article" : "Ajouter un article";
    $("#f-name").value = it ? it.name : "";
    $("#f-cat").value = it ? it.cat : "Fromages";
    $("#f-qty").value = it ? it.qty : 0;
    $("#f-unit").value = it ? it.unit : "u";
    $("#f-min").value = it ? it.min : 1;
    modal.hidden = false; $("#f-name").focus();
  }
  function closeModal() { modal.hidden = true; editingId = null; }
  function wireStockModal() {
    $("#stock-add").addEventListener("click", () => openModal(null));
    $("#modal-cancel").addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });
    $("#stock-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const data = {
        name: $("#f-name").value.trim(), cat: $("#f-cat").value,
        qty: Math.max(0, Number($("#f-qty").value) || 0),
        unit: $("#f-unit").value.trim() || "u",
        min: Math.max(0, Number($("#f-min").value) || 0),
      };
      if (!data.name) return;
      if (editingId) Object.assign(stock.find((s) => s.id === editingId), data);
      else { data.id = "s" + Date.now() + Math.floor(Math.random() * 1000); stock.push(data); }
      saveJSON("qentina.mep.stock", stock); closeModal(); renderStock();
    });
  }

  /* ==================== TÂCHES (local responsable) ==================== */
  const PRIO = { haute: "Haute", normale: "Normale", basse: "Basse" };
  function renderTasks() {
    const list = $("#task-list");
    list.innerHTML = "";
    const order = { haute: 0, normale: 1, basse: 2 };
    const sorted = tasks.slice().sort((a, b) => a.done !== b.done ? (a.done ? 1 : -1) : order[a.prio] - order[b.prio]);
    $("#task-empty").hidden = sorted.length > 0;
    sorted.forEach((t) => {
      const li = document.createElement("li");
      li.className = "task task--" + t.prio + (t.done ? " done" : "");
      li.innerHTML =
        '<span class="task__prio"></span>' +
        '<button class="task__check" data-act="toggle" data-id="' + t.id + '">✓</button>' +
        '<span class="task__txt">' + MEP.escapeHtml(t.text) + "</span>" +
        '<span class="task__badge">' + PRIO[t.prio] + "</span>" +
        '<button class="icon-btn" data-act="del" data-id="' + t.id + '">🗑</button>';
      list.appendChild(li);
    });
    $$("#task-list [data-act]").forEach((b) => b.addEventListener("click", () => {
      const t = tasks.find((x) => x.id === b.dataset.id);
      if (!t) return;
      if (b.dataset.act === "toggle") t.done = !t.done;
      else tasks = tasks.filter((x) => x.id !== b.dataset.id);
      saveJSON("qentina.mep.tasks", tasks); renderTasks();
    }));
  }
  function wireTasks() {
    $("#task-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $("#task-input");
      const text = input.value.trim();
      if (!text) return;
      tasks.push({ id: "t" + Date.now() + Math.floor(Math.random() * 1000), text: text, prio: $("#task-prio").value, done: false });
      input.value = ""; saveJSON("qentina.mep.tasks", tasks); renderTasks();
    });
  }

  /* ==================== HELPERS ==================== */
  function loadJSON(k, fallback) { try { const r = localStorage.getItem(k); if (r) return JSON.parse(r); } catch (e) {} return fallback; }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function fmt(n) { return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100); }
  function round(n) { return Math.round(n * 100) / 100; }
  function attr(s) { return String(s).replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
})();
