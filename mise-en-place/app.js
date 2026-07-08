/* ============================================================
   QENTINA — Mise en Place · logique applicative
   100 % côté client, persistance via localStorage.
   ============================================================ */
(function () {
  "use strict";

  const STORE_KEY = "qentina.miseenplace.v1";

  /* ----- Modèle de mise en place par défaut (checklists par poste) ----- */
  const DEFAULT_STATIONS = [
    {
      id: "ouverture", name: "Ouverture", icon: "🔑",
      items: [
        "Allumer le four et vérifier la montée en température",
        "Contrôler les frigos (températures)",
        "Vérifier la caisse et le fond de monnaie",
        "Mettre en route la machine à café",
      ],
    },
    {
      id: "pizza", name: "Poste pizza", icon: "🍕",
      items: [
        "Sortir et pointer les pâtons",
        "Préparer la sauce tomate du jour",
        "Râper / trancher les mozzarellas",
        "Disposer les garnitures en bacs",
        "Fariner le plan de travail",
      ],
    },
    {
      id: "froid", name: "Poste froid / salades", icon: "🥗",
      items: [
        "Laver et essorer les salades",
        "Préparer les vinaigrettes",
        "Découper les crudités",
        "Vérifier les DLC des produits frais",
      ],
    },
    {
      id: "salle", name: "Salle", icon: "🍽️",
      items: [
        "Dresser et nettoyer les tables",
        "Vérifier les couverts et serviettes",
        "Réassort des cartes et menus",
        "Balayer et passer la serpillière",
      ],
    },
    {
      id: "boissons", name: "Bar / boissons", icon: "🥤",
      items: [
        "Réassort du frigo boissons",
        "Vérifier le stock de glaçons",
        "Contrôler tireuse / softs",
      ],
    },
    {
      id: "fermeture", name: "Fermeture", icon: "🌙",
      items: [
        "Nettoyer le four et le plan de travail",
        "Filmer et ranger les bacs de garniture",
        "Sortir les poubelles",
        "Faire la caisse et clôturer",
        "Éteindre les équipements",
      ],
    },
  ];

  /* ----- Inventaire de départ (exemples pizzeria) ----- */
  const SEED_STOCK = [
    { name: "Farine type 00", cat: "Farine & pâtes", qty: 25, unit: "kg", min: 10 },
    { name: "Mozzarella fior di latte", cat: "Fromages", qty: 8, unit: "kg", min: 5 },
    { name: "Sauce tomate San Marzano", cat: "Sauces & conserves", qty: 12, unit: "boîtes", min: 6 },
    { name: "Huile d'olive", cat: "Épicerie", qty: 4, unit: "L", min: 3 },
    { name: "Jambon / charcuterie", cat: "Charcuterie", qty: 3, unit: "kg", min: 4 },
    { name: "Boîtes à pizza", cat: "Consommables", qty: 40, unit: "u", min: 50 },
  ];

  /* ----- État ----- */
  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return migrate(JSON.parse(raw));
    } catch (e) { /* ignore */ }
    return {
      stations: DEFAULT_STATIONS.map((s) => ({ ...s, checked: {} })),
      prepDate: todayKey(),
      stock: SEED_STOCK.map((s, i) => ({ id: "s" + i + "_" + s.name, ...s })),
      tasks: [],
    };
  }

  function migrate(data) {
    // Garantit la présence des champs attendus si l'ancien format diffère.
    data.stations = data.stations || DEFAULT_STATIONS.map((s) => ({ ...s, checked: {} }));
    data.stock = data.stock || [];
    data.tasks = data.tasks || [];
    data.prepDate = data.prepDate || todayKey();
    return data;
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* quota */ }
  }

  /* ----- Utilitaires date ----- */
  function todayKey() {
    const d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }
  function frenchDate() {
    return new Date().toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long",
    });
  }

  /* Réinitialise la mise en place si on a changé de jour */
  function autoResetIfNewDay() {
    if (state.prepDate !== todayKey()) {
      state.stations.forEach((s) => (s.checked = {}));
      state.prepDate = todayKey();
      save();
    }
  }

  /* ----- Sélecteurs courts ----- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ==================== NAVIGATION ==================== */
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((t) => t.classList.remove("is-active"));
      $$(".view").forEach((v) => v.classList.remove("is-active"));
      tab.classList.add("is-active");
      $("#view-" + tab.dataset.view).classList.add("is-active");
    });
  });

  /* ==================== MISE EN PLACE ==================== */
  function renderPrep() {
    const wrap = $("#stations");
    wrap.innerHTML = "";
    state.stations.forEach((st) => {
      const total = st.items.length;
      const done = st.items.filter((_, i) => st.checked[i]).length;
      const card = document.createElement("div");
      card.className = "station";
      const rows = st.items.map((label, i) => {
        const id = "chk-" + st.id + "-" + i;
        const checked = st.checked[i] ? "checked" : "";
        return (
          '<label class="check" for="' + id + '">' +
          '<input type="checkbox" id="' + id + '" data-station="' + st.id + '" data-idx="' + i + '" ' + checked + ">" +
          '<span class="check__box">✓</span>' +
          '<span class="check__lbl">' + escapeHtml(label) + "</span>" +
          "</label>"
        );
      }).join("");
      card.innerHTML =
        '<div class="station__head">' +
        '<span class="station__name">' + st.icon + " " + escapeHtml(st.name) + "</span>" +
        '<span class="station__count ' + (done === total && total ? "done" : "") + '">' + done + " / " + total + "</span>" +
        "</div>" + rows;
      wrap.appendChild(card);
    });

    $$('#stations input[type=checkbox]').forEach((cb) => {
      cb.addEventListener("change", () => {
        const st = state.stations.find((s) => s.id === cb.dataset.station);
        const idx = Number(cb.dataset.idx);
        if (cb.checked) st.checked[idx] = true; else delete st.checked[idx];
        save();
        renderPrep();
        renderDashboard();
      });
    });

    const { done, total } = prepTotals();
    $("#prep-progress").textContent = done + " / " + total + " tâches réalisées";
  }

  function prepTotals() {
    let done = 0, total = 0;
    state.stations.forEach((s) => {
      total += s.items.length;
      done += s.items.filter((_, i) => s.checked[i]).length;
    });
    return { done, total };
  }

  $("#prep-reset").addEventListener("click", () => {
    if (!confirm("Réinitialiser toutes les cases de la mise en place ?")) return;
    state.stations.forEach((s) => (s.checked = {}));
    state.prepDate = todayKey();
    save();
    renderPrep();
    renderDashboard();
  });

  /* ==================== STOCKS ==================== */
  function stockState(item) {
    if (item.qty <= 0) return "out";
    if (item.qty < item.min) return "low";
    return "ok";
  }

  function renderStock() {
    const body = $("#stock-body");
    body.innerHTML = "";
    const list = state.stock.slice().sort((a, b) => a.name.localeCompare(b.name, "fr"));
    $("#stock-empty").hidden = list.length > 0;

    list.forEach((item) => {
      const st = stockState(item);
      const label = st === "out" ? "Rupture" : st === "low" ? "Bas" : "OK";
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="name">' + escapeHtml(item.name) + "</td>" +
        '<td><span class="tag">' + escapeHtml(item.cat) + "</span></td>" +
        '<td class="num"><span class="qty-cell">' +
          '<button class="qty-btn" data-act="minus" data-id="' + item.id + '" aria-label="Diminuer">−</button>' +
          "<span>" + fmtNum(item.qty) + " " + escapeHtml(item.unit) + "</span>" +
          '<button class="qty-btn" data-act="plus" data-id="' + item.id + '" aria-label="Augmenter">+</button>' +
        "</span></td>" +
        '<td class="num">' + fmtNum(item.min) + " " + escapeHtml(item.unit) + "</td>" +
        '<td><span class="state state--' + st + '">' + label + "</span></td>" +
        '<td><div class="row-actions">' +
          '<button class="icon-btn" data-act="edit" data-id="' + item.id + '" title="Modifier">✎</button>' +
          '<button class="icon-btn" data-act="del" data-id="' + item.id + '" title="Supprimer">🗑</button>' +
        "</div></td>";
      body.appendChild(tr);
    });

    $$("#stock-body [data-act]").forEach((btn) => {
      btn.addEventListener("click", () => handleStockAction(btn.dataset.act, btn.dataset.id));
    });
  }

  function handleStockAction(act, id) {
    const item = state.stock.find((s) => s.id === id);
    if (!item) return;
    if (act === "plus") { item.qty = round(item.qty + step(item)); }
    else if (act === "minus") { item.qty = Math.max(0, round(item.qty - step(item))); }
    else if (act === "del") {
      if (!confirm("Supprimer « " + item.name + " » ?")) return;
      state.stock = state.stock.filter((s) => s.id !== id);
    } else if (act === "edit") { openModal(item); return; }
    save();
    renderStock();
    renderDashboard();
  }

  function step(item) {
    // Pas d'incrément adapté : 1 pour les unités entières, 0,5 sinon.
    return item.unit === "u" || item.unit === "boîtes" ? 1 : 0.5;
  }

  /* ----- Modale ajout / édition ----- */
  let editingId = null;
  const modal = $("#modal");

  function openModal(item) {
    editingId = item ? item.id : null;
    $("#modal-title").textContent = item ? "Modifier l'article" : "Ajouter un article";
    $("#f-name").value = item ? item.name : "";
    $("#f-cat").value = item ? item.cat : "Fromages";
    $("#f-qty").value = item ? item.qty : 0;
    $("#f-unit").value = item ? item.unit : "u";
    $("#f-min").value = item ? item.min : 1;
    modal.hidden = false;
    $("#f-name").focus();
  }
  function closeModal() { modal.hidden = true; editingId = null; }

  $("#stock-add").addEventListener("click", () => openModal(null));
  $("#modal-cancel").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

  $("#stock-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = {
      name: $("#f-name").value.trim(),
      cat: $("#f-cat").value,
      qty: Math.max(0, Number($("#f-qty").value) || 0),
      unit: $("#f-unit").value.trim() || "u",
      min: Math.max(0, Number($("#f-min").value) || 0),
    };
    if (!data.name) return;
    if (editingId) {
      const item = state.stock.find((s) => s.id === editingId);
      Object.assign(item, data);
    } else {
      data.id = "s" + Date.now() + Math.floor(Math.random() * 1000);
      state.stock.push(data);
    }
    save();
    closeModal();
    renderStock();
    renderDashboard();
  });

  /* ==================== TÂCHES ==================== */
  const PRIO_LABEL = { haute: "Haute", normale: "Normale", basse: "Basse" };

  function renderTasks() {
    const list = $("#task-list");
    list.innerHTML = "";
    const order = { haute: 0, normale: 1, basse: 2 };
    const sorted = state.tasks.slice().sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return order[a.prio] - order[b.prio];
    });
    $("#task-empty").hidden = sorted.length > 0;

    sorted.forEach((t) => {
      const li = document.createElement("li");
      li.className = "task task--" + t.prio + (t.done ? " done" : "");
      li.innerHTML =
        '<span class="task__prio"></span>' +
        '<button class="task__check" data-act="toggle" data-id="' + t.id + '" aria-label="Terminer">✓</button>' +
        '<span class="task__txt">' + escapeHtml(t.text) + "</span>" +
        '<span class="task__badge">' + PRIO_LABEL[t.prio] + "</span>" +
        '<button class="icon-btn" data-act="del" data-id="' + t.id + '" title="Supprimer">🗑</button>';
      list.appendChild(li);
    });

    $$("#task-list [data-act]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const t = state.tasks.find((x) => x.id === btn.dataset.id);
        if (!t) return;
        if (btn.dataset.act === "toggle") t.done = !t.done;
        else state.tasks = state.tasks.filter((x) => x.id !== btn.dataset.id);
        save();
        renderTasks();
        renderDashboard();
      });
    });
  }

  $("#task-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#task-input");
    const text = input.value.trim();
    if (!text) return;
    state.tasks.push({
      id: "t" + Date.now() + Math.floor(Math.random() * 1000),
      text: text, prio: $("#task-prio").value, done: false,
    });
    input.value = "";
    save();
    renderTasks();
    renderDashboard();
  });

  /* ==================== TABLEAU DE BORD ==================== */
  function renderDashboard() {
    const { done, total } = prepTotals();
    const pct = total ? Math.round((done / total) * 100) : 0;
    $("#kpi-prep").textContent = pct;
    $("#kpi-prep-bar").style.width = pct + "%";
    $("#kpi-prep-hint").textContent = done + " / " + total + " tâches";

    const low = state.stock.filter((s) => stockState(s) !== "ok");
    $("#kpi-stock").textContent = low.length;

    const open = state.tasks.filter((t) => !t.done).length;
    $("#kpi-tasks").textContent = open;

    const alerts = $("#alert-list");
    alerts.innerHTML = "";
    if (!low.length) {
      alerts.innerHTML = '<li class="ok">✅ Tous les stocks sont au-dessus du seuil.</li>';
    } else {
      low.sort((a, b) => stockState(a) === "out" ? -1 : 1);
      low.forEach((item) => {
        const st = stockState(item);
        const li = document.createElement("li");
        li.innerHTML =
          (st === "out" ? "🔴 " : "🟠 ") +
          "<b>" + escapeHtml(item.name) + "</b> — " +
          (st === "out" ? "en rupture" : "reste " + fmtNum(item.qty) + " " + escapeHtml(item.unit)) +
          " (seuil " + fmtNum(item.min) + " " + escapeHtml(item.unit) + ")";
        alerts.appendChild(li);
      });
    }
  }

  /* ==================== HELPERS ==================== */
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
  function fmtNum(n) { return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100); }
  function round(n) { return Math.round(n * 100) / 100; }

  /* ==================== INIT ==================== */
  autoResetIfNewDay();
  $("#today").textContent = frenchDate();
  $("#greeting-day").textContent = frenchDate();
  renderPrep();
  renderStock();
  renderTasks();
  renderDashboard();
})();
