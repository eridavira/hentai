import { db, ref, onValue } from "./firebase.js";

const $ = (id) => document.getElementById(id);

const HOME_GALLERY_BUTTON_LIMIT = 2;

function escHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderLinks(pagesObj) {
  const bar = $("gallery-links-bar");
  if (!bar) return;

  const entries = Object.entries(pagesObj || {});
  entries.sort((a, b) => {
    const aUpdated = a[1]?.updatedAt || a[1]?.lastPhotoTime || a[1]?.createdAt || 0;
    const bUpdated = b[1]?.updatedAt || b[1]?.lastPhotoTime || b[1]?.createdAt || 0;
    return bUpdated - aUpdated;
  });

  if (entries.length === 0) {
    bar.classList.add("hidden");
    bar.innerHTML = "";
    return;
  }

  bar.classList.remove("hidden");

  const visible = entries.slice(0, HOME_GALLERY_BUTTON_LIMIT);
  const hasMore = entries.length > HOME_GALLERY_BUTTON_LIMIT;

  bar.innerHTML =
    visible
      .map(([pageId, page]) => {
      const name = escHtml(String(page?.name || "").trim() || "Gallery");
      const href = `gallery.html?page=${encodeURIComponent(pageId)}`;
      return `
        <button class="gallery-link-btn" type="button" data-href="${escHtml(href)}" title="Buka gallery">
          <span class="gallery-link-dot" aria-hidden="true"></span>
          <span>${name}</span>
        </button>
      `;
      })
      .join("") +
    (hasMore
      ? `
        <button class="gallery-link-btn gallery-link-more" type="button" data-href="galleries.html" title="Lihat semua tombol">
          <span class="gallery-link-dot" aria-hidden="true"></span>
          <span>Lainnya</span>
        </button>
      `
      : "");

  bar.querySelectorAll(".gallery-link-btn[data-href]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const href = String(btn.getAttribute("data-href") || "").trim();
      if (href) location.href = href;
    });
  });
}

function init() {
  const bar = $("gallery-links-bar");
  if (!bar) return;

  const params = new URLSearchParams(window.location.search);
  const viewingProfile = !!String(params.get("u") || "").trim();
  if (viewingProfile) {
    bar.classList.add("hidden");
    bar.innerHTML = "";
    return;
  }

  onValue(ref(db, "site_galleries/pages"), (snap) => {
    renderLinks(snap.exists() ? snap.val() : {});
  });
}

init();

