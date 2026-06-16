import { ref, onValue } from "./firebase.js";

let serverTimeOffset = 0;
const serverTimeListeners = new Set();
let serverTimeReady = false;

export function initGalleryServerTime(db) {
  onValue(ref(db, ".info/serverTimeOffset"), (snap) => {
    serverTimeOffset = Number(snap.val()) || 0;
    serverTimeReady = true;
    const now = getServerNow();
    serverTimeListeners.forEach((fn) => {
      try {
        fn(now);
      } catch {}
    });
  });
}

export function onGalleryServerTimeTick(callback) {
  serverTimeListeners.add(callback);
  if (serverTimeReady) callback(getServerNow());
  return () => serverTimeListeners.delete(callback);
}

export function getServerNow() {
  return Date.now() + serverTimeOffset;
}

/** Gallery sudah bisa diakses publik (rilis langsung atau jadwal sudah lewat). */
export function isGalleryLive(page = {}, now = getServerNow()) {
  if (page.released === true) return true;
  const releaseAt = Number(page.releaseAt || 0);
  if (releaseAt > 0 && now >= releaseAt) return true;
  if (page.released === false) return false;
  return true;
}

/** Gallery dijadwalkan dan belum waktunya tampil penuh. */
export function isGalleryScheduled(page = {}, now = getServerNow()) {
  if (page.released === true) return false;
  const releaseAt = Number(page.releaseAt || 0);
  return releaseAt > 0 && now < releaseAt;
}

/** Tampil di halaman koleksi gallery (live atau menunggu jadwal). */
export function isGalleryPublicListed(page = {}, now = getServerNow()) {
  return isGalleryLive(page, now) || isGalleryScheduled(page, now);
}

export function getReleaseAt(page = {}) {
  return Number(page.releaseAt || 0);
}

export function getRemainingMs(page = {}, now = getServerNow()) {
  const releaseAt = getReleaseAt(page);
  if (!releaseAt) return 0;
  return Math.max(0, releaseAt - now);
}

export function parseScheduleDuration(h, m, s) {
  const hours = Math.max(0, Math.min(999, Math.floor(Number(h) || 0)));
  const mins = Math.max(0, Math.min(59, Math.floor(Number(m) || 0)));
  const secs = Math.max(0, Math.min(59, Math.floor(Number(s) || 0)));
  return (hours * 3600 + mins * 60 + secs) * 1000;
}

export function formatCountdown(ms) {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return [hours, mins, secs].map((n) => String(n).padStart(2, "0")).join(":");
}

export function formatReleaseDateTime(ts) {
  try {
    return new Date(ts).toLocaleString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}
