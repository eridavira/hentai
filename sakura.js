// Theme khusus untuk akun "sakura"
// Aktif saat:
// - profil yang sedang dilihat adalah ?u=sakura (siapa pun yang melihat)
// - atau user yang sedang login adalah sakura (untuk tampilan akunnya sendiri)

const SAKURA_USERNAME = 'sakura';
const THEME_CLASS = 'theme-sakura';
const BRAND_ID = 'nav-brand';
const BRAND_DEFAULT_TEXT = 'Utsukushii';
const BRAND_SAKURA_TEXT = 'Sakura Haruno';

function getViewedUsername() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const u = (urlParams.get('u') || '').trim().toLowerCase();
    return u || null;
  } catch {
    return null;
  }
}

function getActiveUsername() {
  try {
    const u = (localStorage.getItem('active_user') || '').trim().toLowerCase();
    return u || null;
  } catch {
    return null;
  }
}

function ensureSakuraStyle() {
  const existing = document.getElementById('sakura-theme-style');
  if (existing) return;

  const style = document.createElement('style');
  style.id = 'sakura-theme-style';
  style.textContent = `
    /* Sakura Theme (override CSS variables) */
    body.${THEME_CLASS}{
      --bg: #1a0b12;
      --card: #2a0f1d;
      --p: #ff4fa3;
      --text: #ffe6f2;
      --text-s: #ffb3d6;
      --brd: rgba(255, 79, 163, 0.28);
    }

    body.${THEME_CLASS} nav{
      background: linear-gradient(180deg, rgba(255,79,163,0.10), rgba(42,15,29,1));
      border-bottom-color: rgba(255, 79, 163, 0.28);
    }

    body.${THEME_CLASS} .card{
      box-shadow: 0 10px 30px rgba(255, 79, 163, 0.10);
    }

    body.${THEME_CLASS} .btn{
      background: linear-gradient(135deg, #ff4fa3, #ff77be);
    }

    body.${THEME_CLASS} input,
    body.${THEME_CLASS} textarea{
      background: rgba(0,0,0,0.18);
      border-color: rgba(255, 79, 163, 0.24);
    }

    body.${THEME_CLASS} .btn-view.active{
      background: var(--p);
      border-color: var(--p);
    }

    body.${THEME_CLASS} #${BRAND_ID}{
      color: #ff77be !important;
      text-shadow: 0 0 18px rgba(255, 79, 163, 0.25);
      letter-spacing: 0.2px;
    }
  `;
  document.head.appendChild(style);
}

function applySakuraBrandIfNeeded(isSakuraProfile) {
  const el = document.getElementById(BRAND_ID);
  if (!el) return;

  if (isSakuraProfile) {
    el.textContent = BRAND_SAKURA_TEXT;
    el.setAttribute('aria-label', BRAND_SAKURA_TEXT);
  } else {
    el.textContent = BRAND_DEFAULT_TEXT;
    el.setAttribute('aria-label', BRAND_DEFAULT_TEXT);
  }
}

function applySakuraThemeIfNeeded() {
  ensureSakuraStyle();

  const viewed = getViewedUsername();
  const active = getActiveUsername();
  const isSakuraProfile = viewed === SAKURA_USERNAME;

  // Jika lagi melihat profil sakura, tema harus aktif untuk siapa pun.
  // Jika tidak ada target profil (beranda), tapi yang login sakura, aktif juga.
  const shouldEnable = isSakuraProfile || (!viewed && active === SAKURA_USERNAME);

  document.body.classList.toggle(THEME_CLASS, Boolean(shouldEnable));
  applySakuraBrandIfNeeded(isSakuraProfile);
}

// Run ASAP + after DOM ready (aman untuk load urutan apa pun).
applySakuraThemeIfNeeded();
document.addEventListener('DOMContentLoaded', applySakuraThemeIfNeeded);

