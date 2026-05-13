import { db, ref, onValue } from "./firebase.js";

const $ = (id) => document.getElementById(id);

const PAGE_SIZE = 20;
const DEFAULT_THUMB = "https://images2.imgbox.com/73/0d/9Z6A6C9Z_o.jpg";

let allPageEntries = [];
let filteredPageEntries = [];
let currentPageIndex = 0;
let currentSearchTerm = "";
let searchDebounceT = 0;

function escHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pickThumb(page = {}) {
  // Thumbnail mengikuti "foto dinding" dari gallery tersebut.
  const wallPreview = String(page?.wall_cover_preview || "").trim();
  if (wallPreview) return wallPreview;
  const wall = String(page?.wall_cover || "").trim();
  if (wall) return wall;
  // Fallback: kalau preview/legacy belum ada, baru pakai original.
  const wallOriginal = String(page?.wall_cover_original || "").trim();
  return wallOriginal || DEFAULT_THUMB;
}

function pickUpdatedAt(page = {}) {
  return Number(page?.updatedAt || page?.lastPhotoTime || page?.createdAt || 0);
}

function getTotalPages() {
  const n = filteredPageEntries.length;
  return n === 0 ? 1 : Math.ceil(n / PAGE_SIZE);
}

function clampPageIndex() {
  const total = getTotalPages();
  currentPageIndex = Math.max(0, Math.min(currentPageIndex, total - 1));
}

function updatePaginationUi() {
  const wrap = $("galleries-pagination");
  const prev = $("galleries-page-prev");
  const next = $("galleries-page-next");
  const info = $("galleries-page-info");
  const jump = $("galleries-page-jump");
  if (!wrap || !prev || !next || !info) return;

  const total = filteredPageEntries.length;
  const totalPages = getTotalPages();

  if (total === 0) {
    wrap.classList.add("hidden");
    if (jump) {
      jump.value = "";
      jump.max = "1";
      jump.placeholder = "Halaman...";
    }
    return;
  }

  wrap.classList.remove("hidden");
  const pageNum = currentPageIndex + 1;
  const start = currentPageIndex * PAGE_SIZE + 1;
  const end = Math.min(total, (currentPageIndex + 1) * PAGE_SIZE);
  info.textContent = `Halaman ${pageNum} / ${totalPages} · ${start}–${end} dari ${total}`;

  prev.disabled = currentPageIndex <= 0;
  next.disabled = currentPageIndex >= totalPages - 1;
  prev.style.opacity = prev.disabled ? "0.45" : "";
  next.style.opacity = next.disabled ? "0.45" : "";

  if (jump) {
    jump.max = String(Math.max(1, totalPages));
    jump.placeholder = `1–${Math.max(1, totalPages)}`;
  }
}

function renderGridPage() {
  const grid = $("galleries-grid");
  const empty = $("galleries-empty");
  if (!grid || !empty) return;

  clampPageIndex();

  if (filteredPageEntries.length === 0) {
    grid.innerHTML = "";
    empty.classList.remove("hidden");
    updatePaginationUi();
    return;
  }

  empty.classList.add("hidden");

  const slice = filteredPageEntries.slice(currentPageIndex * PAGE_SIZE, currentPageIndex * PAGE_SIZE + PAGE_SIZE);

  grid.innerHTML = slice
    .map(([pageId, page]) => {
      const name = escHtml(String(page?.name || "").trim() || "Gallery");
      const thumb = escHtml(pickThumb(page));
      const href = `gallery.html?page=${encodeURIComponent(pageId)}&from=galleries`;
      return `
        <button type="button" class="galleries-item" data-href="${escHtml(href)}" title="Buka gallery">
          <img class="galleries-thumb" src="${thumb}" loading="lazy" decoding="async" alt="${name}">
          <div class="galleries-meta">
            <div class="galleries-name">${name}</div>
          </div>
        </button>
      `;
    })
    .join("");

  grid.querySelectorAll(".galleries-item[data-href]").forEach((el) => {
    el.addEventListener("click", () => {
      const href = String(el.getAttribute("data-href") || "").trim();
      if (href) location.href = href;
    });
  });

  updatePaginationUi();
}

function normalizeForSearch(s = "") {
  return String(s || "").trim().toLowerCase();
}

function applySearchFilter() {
  const term = normalizeForSearch(currentSearchTerm);
  if (!term) {
    filteredPageEntries = allPageEntries.slice();
    return;
  }
  filteredPageEntries = allPageEntries.filter(([pageId, page]) => {
    const id = normalizeForSearch(pageId);
    const name = normalizeForSearch(page?.name || "");
    return id.includes(term) || name.includes(term);
  });
}

function renderPages(pagesObj) {
  allPageEntries = Object.entries(pagesObj || {});
  allPageEntries.sort((a, b) => pickUpdatedAt(b[1]) - pickUpdatedAt(a[1]));
  applySearchFilter();
  renderGridPage();
}

function bindPagination() {
  const prev = $("galleries-page-prev");
  const next = $("galleries-page-next");
  const jump = $("galleries-page-jump");
  const jumpBtn = $("galleries-page-jump-btn");
  if (prev) {
    prev.onclick = () => {
      if (currentPageIndex <= 0) return;
      currentPageIndex--;
      renderGridPage();
    };
  }
  if (next) {
    next.onclick = () => {
      if (currentPageIndex >= getTotalPages() - 1) return;
      currentPageIndex++;
      renderGridPage();
    };
  }

  const doJump = () => {
    const totalPages = getTotalPages();
    const raw = String(jump?.value || "").trim();
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    const idx = Math.max(1, Math.min(Math.floor(n), Math.max(1, totalPages))) - 1;
    currentPageIndex = idx;
    renderGridPage();
  };

  if (jumpBtn) jumpBtn.onclick = doJump;
  if (jump) {
    jump.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        doJump();
      }
    });
  }
}

function bindSearch() {
  const input = $("galleries-search");
  const clearBtn = $("galleries-search-clear");
  if (!input) return;

  const applyNow = (val) => {
    currentSearchTerm = String(val || "");
    applySearchFilter();
    currentPageIndex = 0;
    renderGridPage();
  };

  input.addEventListener("input", () => {
    const val = input.value;
    window.clearTimeout(searchDebounceT);
    searchDebounceT = window.setTimeout(() => applyNow(val), 180);
  });

  if (clearBtn) {
    clearBtn.onclick = () => {
      input.value = "";
      applyNow("");
      input.focus();
    };
  }
}

function init() {
  const back = $("btn-back-home");
  if (back) back.onclick = () => (location.href = "index.html");

  bindPagination();
  bindSearch();

  onValue(ref(db, "site_galleries/pages"), (snap) => {
    renderPages(snap.exists() ? snap.val() : {});
  });
}

init();

