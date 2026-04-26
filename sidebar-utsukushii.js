// sidebar-utsukushii.js
(() => {
    const TARGET_USERNAME = "utsukushii";
    const LIST_ID = "user-directory-list";
  
    function normalizeUsername(text = "") {
      return String(text).replace(/^@+/, "").trim().toLowerCase();
    }
  
    function applyGlowToSidebarNames() {
      const list = document.getElementById(LIST_ID);
      if (!list) return;
  
      const nameSpans = list.querySelectorAll("span");
      nameSpans.forEach((span) => {
        const uname = normalizeUsername(span.textContent);
        if (uname === TARGET_USERNAME) {
          span.classList.add("special-nickname", "search-special-nickname");
        } else {
          span.classList.remove("search-special-nickname");
        }
      });
    }
  
    function initSidebarObserver() {
      const list = document.getElementById(LIST_ID);
      if (!list) return false;
  
      // initial pass
      applyGlowToSidebarNames();
  
      // re-apply setiap daftar user berubah (karena render ulang dari app.js)
      const observer = new MutationObserver(() => {
        applyGlowToSidebarNames();
      });
  
      observer.observe(list, {
        childList: true,
        subtree: true
      });
  
      return true;
    }
  
    // tunggu elemen sidebar siap
    function bootstrap(retry = 0) {
      const ok = initSidebarObserver();
      if (!ok && retry < 40) {
        setTimeout(() => bootstrap(retry + 1), 150);
      }
    }
  
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => bootstrap());
    } else {
      bootstrap();
    }
  })();