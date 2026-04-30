import { db, ref, get, onValue } from "./firebase.js";

const $ = (id) => document.getElementById(id);

function escHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPageIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get("page") || "").trim();
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

function openModal(displayUrl, originalUrl, downloadName = "") {
  const modal = $("img-modal");
  const img = $("modal-img");
  const dl = $("modal-download-original");
  if (!modal || !img || !dl) return;

  img.src = displayUrl;

  const original = String(originalUrl || "").trim();
  if (original) {
    dl.href = original;
    dl.setAttribute("download", downloadName || "original");
    dl.style.pointerEvents = "";
    dl.style.opacity = "";
    dl.title = "Unduh foto original";
  } else {
    dl.href = "#";
    dl.removeAttribute("download");
    dl.style.pointerEvents = "none";
    dl.style.opacity = "0.55";
    dl.title = "Foto original tidak tersedia";
  }

  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeModal() {
  const modal = $("img-modal");
  if (!modal) return;
  modal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function renderGrid(photosObj) {
  const grid = $("gallery-grid");
  const empty = $("gallery-empty");
  if (!grid || !empty) return;

  const entries = Object.entries(photosObj || {});
  entries.sort((a, b) => (b[1]?.time || 0) - (a[1]?.time || 0));

  if (entries.length === 0) {
    grid.innerHTML = "";
    empty.classList.remove("hidden");
    $("gallery-count").innerText = "";
    return;
  }

  empty.classList.add("hidden");
  $("gallery-count").innerText = `${entries.length} foto`;

  grid.innerHTML = entries
    .map(([pid, p]) => {
      const thumb = escHtml(String(p?.thumbUrl || p?.mediumUrl || p?.url || "").trim());
      const display = escHtml(String(p?.mediumUrl || p?.thumbUrl || p?.url || "").trim());
      const original = escHtml(String(p?.originalUrl || p?.url || "").trim());
      const time = escHtml(formatTime(p?.time || 0));
      return `
        <button class="gallery-item" type="button" data-display="${display}" data-original="${original}" data-name="${escHtml(pid)}" title="${time}">
          <img src="${thumb}" loading="lazy" alt="Foto ${escHtml(pid)}">
        </button>
      `;
    })
    .join("");

  grid.querySelectorAll(".gallery-item[data-display]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const displayUrl = String(btn.getAttribute("data-display") || "").trim();
      const originalUrl = String(btn.getAttribute("data-original") || "").trim();
      const name = String(btn.getAttribute("data-name") || "").trim();
      if (displayUrl) openModal(displayUrl, originalUrl, name ? `${name}.jpg` : "original.jpg");
    });
  });
}

async function init() {
  $("btn-back-home").onclick = () => (location.href = "index.html");

  const pageId = getPageIdFromUrl();
  if (!pageId) {
    $("gallery-name").innerText = "Gallery tidak ditemukan";
    $("gallery-sub").innerText = "Parameter halaman tidak ada.";
    $("gallery-empty").classList.remove("hidden");
    return;
  }

  const pageSnap = await get(ref(db, `site_galleries/pages/${pageId}`));
  const page = pageSnap.exists() ? pageSnap.val() : null;
  const pageName = String(page?.name || "").trim() || "Gallery";

  document.title = `Gallery - ${pageName}`;
  $("gallery-title").innerText = `/ ${pageName}`;
  $("gallery-name").innerText = pageName;
  $("gallery-sub").innerText = `ID: ${pageId}`;

  onValue(ref(db, `site_galleries/photos/${pageId}`), (snap) => {
    renderGrid(snap.exists() ? snap.val() : {});
  });

  const modal = $("img-modal");
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };
  }
  const closeBtn = $("modal-close");
  if (closeBtn) closeBtn.onclick = closeModal;
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const m = $("img-modal");
    if (m && !m.classList.contains("hidden")) closeModal();
  });
}

init();

