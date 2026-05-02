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

function imgBoxThumbToOriginalUrl(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  const swappedDomain = u.replace(/\/\/thumbs(\d+)\.imgbox\.com\//i, (_m, n) => `//images${n}.imgbox.com/`);
  return swappedDomain.replace(/_t(\.[a-z0-9]+)(\?.*)?$/i, (_m, ext, qs = "") => `_o${ext}${qs}`);
}

function imgBoxAnyToThumbUrl(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  // imagesN -> thumbsN
  const swappedDomain = u.replace(/\/\/images(\d+)\.imgbox\.com\//i, (_m, n) => `//thumbs${n}.imgbox.com/`);
  // _o/_b/_m -> _t
  return swappedDomain.replace(/_(o|b|m)(\.[a-z0-9]+)(\?.*)?$/i, (_m, _k, ext, qs = "") => `_t${ext}${qs}`);
}

function normalizeOriginalUrl({ originalUrl, thumbUrl, fallbackUrl }) {
  const original = String(originalUrl || "").trim();
  const thumb = String(thumbUrl || "").trim();
  const fallback = String(fallbackUrl || "").trim();

  // Prioritas: originalUrl kalau sudah benar.
  const candidate = original || fallback;
  if (!candidate) return "";

  // Fix khusus Imgbox: jika yang tersimpan masih thumbnail (_t / thumbsN), ubah ke original (_o / imagesN).
  const looksLikeImgBoxThumb =
    /\/\/thumbs\d+\.imgbox\.com\//i.test(candidate) || /_t(\.[a-z0-9]+)(\?.*)?$/i.test(candidate);
  const looksLikeImgBoxThumb2 =
    /\/\/thumbs\d+\.imgbox\.com\//i.test(thumb) || /_t(\.[a-z0-9]+)(\?.*)?$/i.test(thumb);

  if (looksLikeImgBoxThumb) return imgBoxThumbToOriginalUrl(candidate);
  if (!original && looksLikeImgBoxThumb2) return imgBoxThumbToOriginalUrl(thumb);

  return candidate;
}

function normalizeDisplayUrl({ displayUrl, thumbUrl, fallbackUrl }) {
  const display = String(displayUrl || "").trim();
  const thumb = String(thumbUrl || "").trim();
  const fallback = String(fallbackUrl || "").trim();

  const candidate = display || thumb || fallback;
  if (!candidate) return "";

  // Untuk Imgbox, pakai thumbnail di modal agar hemat data.
  const looksLikeImgBox =
    /\/\/(thumbs|images)\d+\.imgbox\.com\//i.test(candidate) ||
    /imgbox\.com/i.test(candidate);

  if (!looksLikeImgBox) return candidate;

  // Prioritas: thumbUrl kalau jelas thumbs/_t
  if (/\/\/thumbs\d+\.imgbox\.com\//i.test(thumb) || /_t(\.[a-z0-9]+)(\?.*)?$/i.test(thumb)) return thumb;

  // Jika yang ada images/_b atau _o, konversi ke thumbs/_t
  return imgBoxAnyToThumbUrl(candidate);
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
    dl.target = "_blank";
    dl.rel = "noopener noreferrer";
    dl.removeAttribute("download");
    dl.style.pointerEvents = "";
    dl.style.opacity = "";
    dl.title = "Buka foto original di tab baru";
  } else {
    dl.href = "#";
    dl.removeAttribute("download");
    dl.removeAttribute("target");
    dl.removeAttribute("rel");
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
      const rawThumb = String(p?.thumbUrl || p?.mediumUrl || p?.url || "").trim();
      const rawDisplay = normalizeDisplayUrl({
        displayUrl: p?.mediumUrl || p?.url,
        thumbUrl: rawThumb,
        fallbackUrl: p?.url,
      });
      const rawOriginal = normalizeOriginalUrl({
        originalUrl: p?.originalUrl,
        thumbUrl: rawThumb,
        fallbackUrl: p?.url,
      });

      const thumb = escHtml(rawThumb);
      const display = escHtml(rawDisplay);
      const original = escHtml(rawOriginal);
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

