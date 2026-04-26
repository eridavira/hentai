import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = { databaseURL: "https://hentai-86b5f-default-rtdb.asia-southeast1.firebasedatabase.app/" };
const app = initializeApp(firebaseConfig, "utsukushii-special-app");
const db = getDatabase(app);

const SPECIAL_USER = "utsukushii";
const SLOT_COUNT = 1;
const IMGBB_API_KEY = "c0e6f15eb26082b61ce8c39cf8b3ccdd";

const $ = (id) => document.getElementById(id);

function escHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getActiveUser() {
  return String(localStorage.getItem("active_user") || "").trim().toLowerCase();
}

function ensureStripContainer() {
  let strip = $("top-liked-strip");
  if (strip) return strip;
  const profileCard = $("profile-view");
  if (!profileCard) return null;

  strip = document.createElement("div");
  strip.id = "top-liked-strip";
  strip.className = "top-liked-strip hidden";
  profileCard.appendChild(strip);
  return strip;
}

function clearStrip() {
  const strip = $("top-liked-strip");
  if (!strip) return;
  strip.classList.add("hidden");
  strip.innerHTML = "";
}

function createSlotHtml(slotNumber, imageUrl, isEditable) {
  const safeUrl = escHtml(String(imageUrl || "").trim());
  return `
    <button class="top-liked-item ${isEditable ? "is-editable" : ""}" data-slot="${slotNumber}" type="button" ${isEditable ? 'title="Klik untuk upload foto"' : 'title="Foto sorotan utsukushii"'} ${isEditable ? "" : "disabled"}>
      ${safeUrl ? `<img src="${safeUrl}" alt="Foto sorotan ${slotNumber}">` : `<span class="top-liked-placeholder">Slot ${slotNumber}</span>`}
    </button>
  `;
}

function uploadToImgBB(file) {
  return new Promise((resolve) => {
    const formData = new FormData();
    formData.append("image", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, true);
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || "{}");
        resolve(data.success ? (data.data?.url || "") : "");
      } catch {
        resolve("");
      }
    };
    xhr.onerror = () => resolve("");
    xhr.onabort = () => resolve("");
    xhr.send(formData);
  });
}

async function selectAndUploadSlot(slotNumber) {
  const active = getActiveUser();
  if (active !== SPECIAL_USER) return;

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const imageUrl = await uploadToImgBB(file);
    if (!imageUrl) {
      alert("Upload gagal, coba lagi.");
      return;
    }

    await update(ref(db, `users/${SPECIAL_USER}/profile`), {
      [`featuredPhotos/slot${slotNumber}`]: imageUrl
    });
    await renderFeaturedSlots(true);
  };
  fileInput.click();
}

async function renderFeaturedSlots(isEditable) {
  const strip = ensureStripContainer();
  if (!strip) return;

  const profileSnap = await get(ref(db, `users/${SPECIAL_USER}/profile`));
  const profile = profileSnap.val() || {};
  const featuredPhotos = profile.featuredPhotos || {};

  strip.innerHTML = `<div class="top-liked-row">
    ${Array.from({ length: SLOT_COUNT }, (_, idx) => {
      const slotNumber = idx + 1;
      const slotKey = `slot${slotNumber}`;
      return createSlotHtml(slotNumber, featuredPhotos[slotKey], isEditable);
    }).join("")}
  </div>`;
  strip.classList.remove("hidden");

  if (isEditable) {
    strip.querySelectorAll(".top-liked-item[data-slot]").forEach((el) => {
      el.addEventListener("click", () => {
        const slot = Number(el.getAttribute("data-slot") || 0);
        if (!slot) return;
        selectAndUploadSlot(slot);
      });
    });
  }
}

async function applyProfileDecorations({ viewedUser }) {
  const username = String(viewedUser || "").trim().toLowerCase();
  const isSpecialProfile = username === SPECIAL_USER;
  const activeUser = getActiveUser();
  const canEditSlots = isSpecialProfile && activeUser === SPECIAL_USER;

  const viewNameEl = $("view-name");
  const profileCardEl = $("profile-view");
  if (!viewNameEl || !profileCardEl) return;

  viewNameEl.classList.toggle("special-nickname", isSpecialProfile);
  profileCardEl.classList.toggle("special-profile-theme", isSpecialProfile);

  if (!isSpecialProfile) {
    clearStrip();
    return;
  }

  await renderFeaturedSlots(canEditSlots);
}

window.UtsukushiiProfile = {
  applyProfileDecorations
};

