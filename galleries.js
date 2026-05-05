import { db, ref, onValue } from "./firebase.js";

const $ = (id) => document.getElementById(id);

const DEFAULT_THUMB = "https://images2.imgbox.com/73/0d/9Z6A6C9Z_o.jpg";

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
  // Prioritas: original (kalau ada) → preview → fallback legacy.
  const wallOriginal = String(page?.wall_cover_original || "").trim();
  if (wallOriginal) return wallOriginal;
  const wallPreview = String(page?.wall_cover_preview || "").trim();
  if (wallPreview) return wallPreview;
  const wall = String(page?.wall_cover || "").trim();
  return wall || DEFAULT_THUMB;
}

function pickUpdatedAt(page = {}) {
  return Number(page?.updatedAt || page?.lastPhotoTime || page?.createdAt || 0);
}

function renderPages(pagesObj) {
  const grid = $("galleries-grid");
  const empty = $("galleries-empty");
  if (!grid || !empty) return;

  const entries = Object.entries(pagesObj || {});
  entries.sort((a, b) => pickUpdatedAt(b[1]) - pickUpdatedAt(a[1]));

  if (entries.length === 0) {
    grid.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");
  grid.innerHTML = entries
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
}

function init() {
  const back = $("btn-back-home");
  if (back) back.onclick = () => (location.href = "index.html");

  onValue(ref(db, "site_galleries/pages"), (snap) => {
    renderPages(snap.exists() ? snap.val() : {});
  });
}

init();

