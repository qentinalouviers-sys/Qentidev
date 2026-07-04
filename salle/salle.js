/* ============================================================
   QENTINA — Plan de salle & réservations
   Outil interne, 100% local (aucune donnée n'est envoyée).
   Sauvegarde dans le navigateur (localStorage).
   ============================================================ */
(function () {
  "use strict";

  const STORE_KEY = "qentina_salle_v1";
  const GRID = 20;                 // pas de la grille (px)
  const SEAT_DEFAULT = { square: 4, round: 4, rect: 6 };

  // ---------- État ----------
  let store = load();
  let currentDate = todayStr();
  let mode = "place";              // "place" | "edit"
  let service = "midi";            // "midi" | "soir"
  let selection = new Set();       // ids de tables sélectionnées (édition)
  let editingTable = null;         // table ouverte dans le panneau
  let uid = Date.now();

  // ---------- Raccourcis DOM ----------
  const $ = (s) => document.querySelector(s);
  const app = $("#app");
  const stage = $("#stage");
  const stageScroll = $("#stageScroll");

  // ============================================================
  //  Persistance
  // ============================================================
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return { days: {} };
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) {}
  }
  function newId() { uid += 1; return "id" + uid.toString(36); }

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function pad(n) { return String(n).padStart(2, "0"); }

  function day(date) {
    if (!store.days[date]) store.days[date] = { tables: [], reservations: [] };
    return store.days[date];
  }
  const D = () => day(currentDate);

  // ============================================================
  //  Modèle : unités (table seule ou groupe de tables)
  // ============================================================
  function unitId(t) { return t.groupId ? "g:" + t.groupId : "t:" + t.id; }
  function tablesOfUnit(uid_) {
    if (uid_.startsWith("g:")) {
      const gid = uid_.slice(2);
      return D().tables.filter((t) => t.groupId === gid);
    }
    const id = uid_.slice(2);
    return D().tables.filter((t) => t.id === id);
  }
  function unitCapacity(uid_) {
    return tablesOfUnit(uid_).reduce((s, t) => s + (t.seats || 0), 0);
  }
  function unitBBox(uid_) {
    const ts = tablesOfUnit(uid_);
    if (!ts.length) return null;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    ts.forEach((t) => {
      x1 = Math.min(x1, t.x); y1 = Math.min(y1, t.y);
      x2 = Math.max(x2, t.x + t.w); y2 = Math.max(y2, t.y + t.h);
    });
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
  function reservationOnUnit(uid_) {
    return D().reservations.find((r) => r.unit === uid_ && r.service === service);
  }

  // ============================================================
  //  Rendu
  // ============================================================
  function render() {
    app.classList.toggle("mode-edit", mode === "edit");
    app.classList.toggle("mode-place", mode === "place");
    $("#editToolbar").hidden = mode !== "edit";
    $("#modePlace").classList.toggle("active", mode === "place");
    $("#modeEdit").classList.toggle("active", mode === "edit");
    renderDateLabel();
    renderStage();
    renderReservations();
    renderStats();
    renderEditButtons();
    renderHint();
  }

  function renderDateLabel() {
    $("#dateInput").value = currentDate;
    const d = new Date(currentDate + "T12:00:00");
    $("#dateLabel").textContent = d.toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long",
    });
  }

  function renderStage() {
    // on retire tout sauf la grille
    [...stage.querySelectorAll(".tbl,.seat-dot,.group-hull,.assign-chip,.resize-h")]
      .forEach((el) => el.remove());

    const d = D();

    // 1) enveloppes de groupe (derrière)
    const groups = new Set(d.tables.filter((t) => t.groupId).map((t) => t.groupId));
    groups.forEach((gid) => {
      const bb = unitBBox("g:" + gid);
      if (!bb) return;
      const pad = 12;
      const hull = document.createElement("div");
      hull.className = "group-hull";
      hull.style.left = bb.x - pad + "px";
      hull.style.top = bb.y - pad + "px";
      hull.style.width = bb.w + pad * 2 + "px";
      hull.style.height = bb.h + pad * 2 + "px";
      hull.innerHTML = `<span class="gh-badge">Grande table · ${unitCapacity("g:" + gid)} cvts</span>`;
      stage.appendChild(hull);
    });

    // 2) tables + pastilles de couverts
    d.tables.forEach((t) => {
      drawSeats(t);
      const el = document.createElement("div");
      el.className = "tbl " + t.shape;
      el.dataset.id = t.id;
      el.style.left = t.x + "px";
      el.style.top = t.y + "px";
      el.style.width = t.w + "px";
      el.style.height = t.h + "px";
      if (selection.has(t.id)) el.classList.add("selected");
      if (reservationOnUnit(unitId(t))) el.classList.add("assigned");
      el.innerHTML =
        `<div class="tbl-label">${escapeHtml(t.label || "")}</div>` +
        `<div class="tbl-seats">${t.seats} cvts</div>`;
      // poignée de redimensionnement (édition + sélection)
      if (mode === "edit" && selection.has(t.id)) {
        const h = document.createElement("div");
        h.className = "resize-h";
        el.appendChild(h);
        h.addEventListener("pointerdown", (e) => startResize(e, t));
      }
      el.addEventListener("pointerdown", (e) => onTablePointerDown(e, t));
      stage.appendChild(el);
    });

    // 3) étiquettes de réservation (unités occupées)
    const seen = new Set();
    d.tables.forEach((t) => {
      const u = unitId(t);
      if (seen.has(u)) return;
      seen.add(u);
      const r = reservationOnUnit(u);
      if (!r) return;
      const bb = unitBBox(u);
      const cap = unitCapacity(u);
      const chip = document.createElement("div");
      chip.className = "assign-chip" + (r.party > cap ? " over-cap" : "");
      chip.style.left = bb.x + "px";
      chip.style.top = bb.y - 6 + "px";
      chip.style.transform = "translateY(-100%)";
      chip.innerHTML =
        `<div class="ac-name"><span>${escapeHtml(r.name)}</span>` +
        `<button class="ac-x" title="Libérer la table">×</button></div>` +
        `<div class="ac-meta">${r.time} · ${r.party} cvts${r.party > cap ? " ⚠︎" : ""}</div>`;
      chip.querySelector(".ac-x").addEventListener("click", (e) => {
        e.stopPropagation(); unassign(r.id);
      });
      stage.appendChild(chip);
    });
  }

  function drawSeats(t) {
    const n = t.seats || 0;
    const pts = seatPositions(t);
    pts.slice(0, n).forEach((p) => {
      const dot = document.createElement("div");
      dot.className = "seat-dot";
      dot.style.left = p.x + "px";
      dot.style.top = p.y + "px";
      stage.appendChild(dot);
    });
  }

  // positions des pastilles autour d'une table
  function seatPositions(t) {
    const n = t.seats || 0;
    const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
    const out = [];
    if (t.shape === "round") {
      const R = Math.max(t.w, t.h) / 2 + 11;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        out.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
      }
      return out;
    }
    // rectangle : on répartit sur le périmètre extérieur
    const m = 11;
    const W = t.w + m * 2, H = t.h + m * 2;
    const left = t.x - m, top = t.y - m;
    const perim = 2 * (W + H);
    for (let i = 0; i < n; i++) {
      let dpos = ((i + 0.5) / n) * perim;
      let x, y;
      if (dpos < W) { x = left + dpos; y = top; }
      else if (dpos < W + H) { x = left + W; y = top + (dpos - W); }
      else if (dpos < 2 * W + H) { x = left + W - (dpos - W - H); y = top + H; }
      else { x = left; y = top + H - (dpos - 2 * W - H); }
      out.push({ x, y });
    }
    return out;
  }

  // ---------- Réservations (sidebar) ----------
  function renderReservations() {
    const d = D();
    const list = d.reservations
      .filter((r) => r.service === service)
      .sort((a, b) => a.time.localeCompare(b.time));
    const wait = list.filter((r) => !r.unit || !tablesOfUnit(r.unit).length);
    const seated = list.filter((r) => r.unit && tablesOfUnit(r.unit).length);

    const waitEl = $("#waitList"), seatEl = $("#seatList");
    waitEl.innerHTML = ""; seatEl.innerHTML = "";
    if (!wait.length) waitEl.innerHTML = `<div class="empty-msg">Aucune réservation en attente.</div>`;
    if (!seated.length) seatEl.innerHTML = `<div class="empty-msg">Aucune table attribuée.</div>`;

    wait.forEach((r) => waitEl.appendChild(resaCard(r, false)));
    seated.forEach((r) => seatEl.appendChild(resaCard(r, true)));

    $("#waitCount").textContent = wait.length;
    $("#seatCount").textContent = seated.length;
  }

  function resaCard(r, seated) {
    const el = document.createElement("div");
    el.className = "resa-card" + (seated ? " seated" : "");
    el.dataset.id = r.id;
    let tableTxt = "";
    if (seated) {
      const labels = tablesOfUnit(r.unit).map((t) => t.label).filter(Boolean);
      tableTxt = `<span class="rc-table">▸ ${labels.join(" + ") || "Table"}</span>`;
    }
    el.innerHTML =
      `<div class="rc-top"><span class="rc-name">${escapeHtml(r.name)}</span>` +
      `<span class="rc-time">${r.time}</span></div>` +
      `<div class="rc-meta"><span class="rc-party">${r.party} couverts</span>` +
      (r.phone ? `<span>${escapeHtml(r.phone)}</span>` : "") +
      tableTxt +
      `<button class="rc-del" title="Supprimer">🗑</button></div>` +
      (r.note ? `<div class="rc-meta rc-note">${escapeHtml(r.note)}</div>` : "");
    el.querySelector(".rc-del").addEventListener("click", (e) => {
      e.stopPropagation();
      D().reservations = D().reservations.filter((x) => x.id !== r.id);
      save(); render();
    });
    el.addEventListener("pointerdown", (e) => startResaDrag(e, r, el));
    return el;
  }

  function renderStats() {
    const d = D();
    const totalSeats = d.tables.reduce((s, t) => s + (t.seats || 0), 0);
    const list = d.reservations.filter((r) => r.service === service);
    const seatedCovers = list
      .filter((r) => r.unit && tablesOfUnit(r.unit).length)
      .reduce((s, r) => s + r.party, 0);
    const waiting = list.filter((r) => !r.unit || !tablesOfUnit(r.unit).length).length;
    $("#statsBar").innerHTML =
      `<span class="stat-pill"><span class="dot" style="background:var(--terra)"></span>` +
      `<b>${d.tables.length}</b>&nbsp;tables · <b>${totalSeats}</b>&nbsp;couverts</span>` +
      `<span class="stat-pill"><span class="dot" style="background:var(--olive)"></span>` +
      `<b>${seatedCovers}</b>&nbsp;couverts placés</span>` +
      `<span class="stat-pill"><span class="dot" style="background:var(--gold)"></span>` +
      `<b>${waiting}</b>&nbsp;en attente</span>` +
      `<span class="stat-pill" style="margin-left:auto;color:var(--ink-soft)">Service : <b>${service === "midi" ? "Midi" : "Soir"}</b></span>`;
  }

  function renderEditButtons() {
    const n = selection.size;
    $("#groupBtn").disabled = n < 2;
    const anyGrouped = [...selection].some((id) => {
      const t = D().tables.find((x) => x.id === id); return t && t.groupId;
    });
    $("#ungroupBtn").disabled = !anyGrouped;
    $("#deleteBtn").disabled = n < 1;
  }

  function renderHint() {
    const h = $("#planHint");
    const d = D();
    if (mode === "edit" && d.tables.length === 0) {
      const src = latestPlanBefore(currentDate);
      if (src) {
        h.hidden = false;
        h.innerHTML = `Plan vide. <button id="reuseBtn">Reprendre le plan du ${frShort(src)}</button>` +
          `<button class="hint-x" id="hintX">×</button>`;
        $("#reuseBtn").onclick = () => { copyPlanFrom(src); };
        $("#hintX").onclick = () => { h.hidden = true; };
        return;
      }
    }
    h.hidden = true;
  }

  // ============================================================
  //  Déplacement / redimensionnement des tables (édition)
  // ============================================================
  let tableDrag = null;

  function onTablePointerDown(e, t) {
    if (e.target.classList.contains("resize-h")) return;
    if (mode === "place") return;          // en mode réservation, pas de déplacement
    e.preventDefault();

    // sélection : clic simple = seule ; maj/ctrl = ajout
    if (!(e.shiftKey || e.ctrlKey || e.metaKey)) {
      if (!selection.has(t.id)) selection = new Set([t.id]);
    } else {
      selection.has(t.id) ? selection.delete(t.id) : selection.add(t.id);
    }
    openTablePanel(t);

    // on déplace toute la sélection (utile pour les groupes)
    const ids = selection.has(t.id) ? [...selection] : [t.id];
    // si la table appartient à un groupe, on déplace tout le groupe
    const moveIds = new Set(ids);
    ids.forEach((id) => {
      const tt = D().tables.find((x) => x.id === id);
      if (tt && tt.groupId) {
        D().tables.filter((x) => x.groupId === tt.groupId).forEach((x) => moveIds.add(x.id));
      }
    });
    const start = { x: e.clientX, y: e.clientY };
    const origins = {};
    moveIds.forEach((id) => {
      const tt = D().tables.find((x) => x.id === id);
      origins[id] = { x: tt.x, y: tt.y };
    });
    tableDrag = { moveIds: [...moveIds], start, origins, moved: false };
    e.target.setPointerCapture(e.pointerId);
    render();

    const move = (ev) => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) tableDrag.moved = true;
      tableDrag.moveIds.forEach((id) => {
        const tt = D().tables.find((x) => x.id === id);
        tt.x = snap(Math.max(0, origins[id].x + dx));
        tt.y = snap(Math.max(0, origins[id].y + dy));
      });
      renderStage();
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      if (tableDrag && tableDrag.moved) save();
      tableDrag = null;
      render();
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  }

  function startResize(e, t) {
    e.preventDefault(); e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY, w: t.w, h: t.h };
    e.target.setPointerCapture(e.pointerId);
    const move = (ev) => {
      let w = snap(Math.max(50, start.w + (ev.clientX - start.x)));
      let h = snap(Math.max(50, start.h + (ev.clientY - start.y)));
      if (t.shape === "round") { const s = Math.max(w, h); w = s; h = s; }
      t.w = w; t.h = h;
      renderStage();
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      save(); render();
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  }

  // clic dans le vide → désélectionne
  stage.addEventListener("pointerdown", (e) => {
    if (e.target === stage || e.target.classList.contains("stage-grid")) {
      selection.clear(); closeTablePanel(); render();
    }
  });

  function snap(v) { return Math.round(v / GRID) * GRID; }

  // ============================================================
  //  Attribution d'une réservation par glisser-déposer
  // ============================================================
  let resaDrag = null;
  const ghost = $("#dragGhost");

  function startResaDrag(e, r, cardEl) {
    // en édition on ne place pas de réservations
    if (mode === "edit") return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    resaDrag = { r, start, active: false, cardEl };
    cardEl.setPointerCapture(e.pointerId);

    const move = (ev) => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (!resaDrag.active && Math.abs(dx) + Math.abs(dy) > 6) {
        resaDrag.active = true;
        ghost.hidden = false;
        ghost.textContent = `${r.name} · ${r.party} cvts`;
        cardEl.classList.add("picking");
      }
      if (resaDrag.active) {
        ghost.style.left = ev.clientX + "px";
        ghost.style.top = ev.clientY + "px";
        highlightDropTarget(ev.clientX, ev.clientY);
      }
    };
    const up = (ev) => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      ghost.hidden = true;
      cardEl.classList.remove("picking");
      clearDropHover();
      if (resaDrag.active) {
        const tbl = tableAt(ev.clientX, ev.clientY);
        if (tbl) assign(r.id, tbl.id);
      }
      resaDrag = null;
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  }

  function tableAt(cx, cy) {
    const el = document.elementFromPoint(cx, cy);
    if (!el) return null;
    const tblEl = el.closest(".tbl");
    if (!tblEl) return null;
    return D().tables.find((t) => t.id === tblEl.dataset.id) || null;
  }
  function highlightDropTarget(cx, cy) {
    clearDropHover();
    const t = tableAt(cx, cy);
    if (t) {
      const el = stage.querySelector(`.tbl[data-id="${t.id}"]`);
      if (el) el.classList.add("drop-hover");
    }
  }
  function clearDropHover() {
    stage.querySelectorAll(".drop-hover").forEach((el) => el.classList.remove("drop-hover"));
  }

  function assign(resaId, tableId) {
    const r = D().reservations.find((x) => x.id === resaId);
    const t = D().tables.find((x) => x.id === tableId);
    if (!r || !t) return;
    const u = unitId(t);
    // si une autre résa occupe déjà cette unité (même service), on la libère
    D().reservations.forEach((x) => {
      if (x !== r && x.unit === u && x.service === r.service) x.unit = null;
    });
    r.unit = u;
    save(); render();
  }
  function unassign(resaId) {
    const r = D().reservations.find((x) => x.id === resaId);
    if (r) { r.unit = null; save(); render(); }
  }

  // ============================================================
  //  Panneau de réglage d'une table
  // ============================================================
  function openTablePanel(t) {
    if (mode !== "edit") return;
    editingTable = t;
    const p = $("#tablePanel");
    p.hidden = false;
    $("#tpTitle").textContent = "Table " + (t.label || "");
    $("#tpLabel").value = t.label || "";
    $("#tpSeats").value = t.seats;
  }
  function closeTablePanel() { $("#tablePanel").hidden = true; editingTable = null; }

  $("#tpClose").addEventListener("click", closeTablePanel);
  $("#tpLabel").addEventListener("input", (e) => {
    if (editingTable) { editingTable.label = e.target.value; save(); renderStage(); }
  });
  $("#tpSeats").addEventListener("input", (e) => {
    if (editingTable) {
      editingTable.seats = Math.max(1, Math.min(20, parseInt(e.target.value || "1", 10)));
      save(); renderStage();
    }
  });
  document.querySelectorAll(".tp-size .icon-btn").forEach((b) => {
    b.addEventListener("click", () => {
      if (!editingTable) return;
      const step = b.dataset.size === "+" ? GRID : -GRID;
      editingTable.w = Math.max(50, editingTable.w + step);
      editingTable.h = Math.max(50, editingTable.h + step);
      save(); renderStage();
    });
  });

  // ============================================================
  //  Ajout / groupage / suppression de tables
  // ============================================================
  function addTable(shape) {
    // position : centre visible de la scène
    const cx = snap(stageScroll.scrollLeft + stageScroll.clientWidth / 2 - 45);
    const cy = snap(stageScroll.scrollTop + stageScroll.clientHeight / 2 - 45);
    const size = shape === "rect" ? { w: 180, h: 80 } : { w: 90, h: 90 };
    const t = {
      id: newId(), shape, x: cx, y: cy, w: size.w, h: size.h,
      seats: SEAT_DEFAULT[shape], label: nextLabel(), groupId: null,
    };
    D().tables.push(t);
    selection = new Set([t.id]);
    save(); render(); openTablePanel(t);
  }
  function nextLabel() {
    const nums = D().tables.map((t) => parseInt(t.label, 10)).filter((n) => !isNaN(n));
    return String((nums.length ? Math.max(...nums) : 0) + 1);
  }

  function groupSelection() {
    if (selection.size < 2) return;
    const gid = "g" + newId();
    D().tables.forEach((t) => { if (selection.has(t.id)) t.groupId = gid; });
    save(); render();
  }
  function ungroupSelection() {
    const gids = new Set();
    D().tables.forEach((t) => { if (selection.has(t.id) && t.groupId) gids.add(t.groupId); });
    D().tables.forEach((t) => { if (gids.has(t.groupId)) t.groupId = null; });
    save(); render();
  }
  function deleteSelection() {
    if (!selection.size) return;
    const ids = new Set(selection);
    D().tables = D().tables.filter((t) => !ids.has(t.id));
    // libère les réservations dont l'unité n'existe plus
    D().reservations.forEach((r) => {
      if (r.unit && !tablesOfUnit(r.unit).length) r.unit = null;
    });
    selection.clear(); closeTablePanel(); save(); render();
  }

  // ============================================================
  //  Gestion des plans par date
  // ============================================================
  function latestPlanBefore(date) {
    const dates = Object.keys(store.days)
      .filter((d) => d < date && store.days[d].tables.length)
      .sort();
    return dates.length ? dates[dates.length - 1] : null;
  }
  function copyPlanFrom(srcDate) {
    const src = store.days[srcDate];
    if (!src) return;
    // remap des ids pour éviter les collisions, conserve les groupes
    const gidMap = {};
    D().tables = src.tables.map((t) => {
      let gid = t.groupId;
      if (gid) { if (!gidMap[gid]) gidMap[gid] = "g" + newId(); gid = gidMap[gid]; }
      return { ...t, id: newId(), groupId: gid };
    });
    save(); render();
  }
  function frShort(date) {
    return new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  }

  // ============================================================
  //  Câblage de l'interface
  // ============================================================
  // formulaire réservation
  $("#resaForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#fName").value.trim();
    if (!name) return;
    D().reservations.push({
      id: newId(), name,
      time: $("#fTime").value || "20:00",
      party: Math.max(1, parseInt($("#fParty").value || "2", 10)),
      phone: $("#fPhone").value.trim(),
      note: $("#fNote").value.trim(),
      service, unit: null,
    });
    e.target.reset();
    $("#fParty").value = 2;
    $("#fTime").value = service === "midi" ? "12:30" : "20:00";
    save(); render();
    $("#fName").focus();
  });

  // service
  document.querySelectorAll(".svc-btn").forEach((b) => {
    b.addEventListener("click", () => {
      service = b.dataset.svc;
      document.querySelectorAll(".svc-btn").forEach((x) => x.classList.toggle("active", x === b));
      $("#fTime").value = service === "midi" ? "12:30" : "20:00";
      render();
    });
  });

  // modes
  $("#modePlace").addEventListener("click", () => { mode = "place"; selection.clear(); closeTablePanel(); render(); });
  $("#modeEdit").addEventListener("click", () => { mode = "edit"; render(); });

  // navigation date
  $("#dateInput").addEventListener("change", (e) => { currentDate = e.target.value || todayStr(); selection.clear(); closeTablePanel(); render(); });
  $("#prevDay").addEventListener("click", () => shiftDate(-1));
  $("#nextDay").addEventListener("click", () => shiftDate(1));
  $("#todayBtn").addEventListener("click", () => { currentDate = todayStr(); selection.clear(); closeTablePanel(); render(); });
  function shiftDate(n) {
    const d = new Date(currentDate + "T12:00:00");
    d.setDate(d.getDate() + n);
    currentDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    selection.clear(); closeTablePanel(); render();
  }

  // barre d'édition
  $("#addSquare").addEventListener("click", () => addTable("square"));
  $("#addRound").addEventListener("click", () => addTable("round"));
  $("#addRect").addEventListener("click", () => addTable("rect"));
  $("#groupBtn").addEventListener("click", groupSelection);
  $("#ungroupBtn").addEventListener("click", ungroupSelection);
  $("#deleteBtn").addEventListener("click", deleteSelection);
  $("#clearPlanBtn").addEventListener("click", () => {
    if (confirm("Vider tout le plan de ce jour ? Les réservations seront désattribuées.")) {
      D().tables = [];
      D().reservations.forEach((r) => (r.unit = null));
      selection.clear(); closeTablePanel(); save(); render();
    }
  });
  $("#copyPlanBtn").addEventListener("click", () => {
    const src = latestPlanBefore(currentDate) || Object.keys(store.days).filter((d) => d !== currentDate && store.days[d].tables.length).sort().pop();
    if (!src) { alert("Aucun plan existant à reprendre."); return; }
    const label = frShort(src);
    if (confirm(`Reprendre le plan du ${label} sur ce jour ? Le plan actuel sera remplacé.`)) copyPlanFrom(src);
  });

  // clavier : Suppr pour effacer, Échap pour désélectionner
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea")) return;
    if (mode === "edit" && (e.key === "Delete" || e.key === "Backspace") && selection.size) {
      e.preventDefault(); deleteSelection();
    }
    if (e.key === "Escape") { selection.clear(); closeTablePanel(); render(); }
  });

  // ---------- util ----------
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---------- démarrage ----------
  // plan de démonstration si tout est vide au tout premier lancement
  if (Object.keys(store.days).length === 0) seedDemo();
  $("#fTime").value = "12:30";
  render();
  // centre la vue
  stageScroll.scrollLeft = (stage.offsetWidth - stageScroll.clientWidth) / 2 - 100;
  stageScroll.scrollTop = 40;

  function seedDemo() {
    const d = day(currentDate);
    const T = (shape, x, y, seats, label, w, h) => ({
      id: newId(), shape, x, y, w: w || 90, h: h || 90, seats, label: String(label), groupId: null,
    });
    d.tables = [
      T("round", 620, 220, 2, 1, 80, 80),
      T("round", 760, 220, 2, 2, 80, 80),
      T("square", 620, 380, 4, 3),
      T("square", 760, 380, 4, 4),
      T("square", 900, 380, 4, 5),
      T("rect", 600, 560, 6, 6, 180, 80),
      T("round", 900, 220, 4, 7, 100, 100),
    ];
  }
})();
