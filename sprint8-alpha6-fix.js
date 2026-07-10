(() => {
  const VERSION = "v0.9.3-alpha6";
  const FOOTER_TEXT = `GPT Plant Walk ${VERSION} — Sprint 8 Alpha 6`;

  function enforceVersion() {
    const footer = document.getElementById("appVersionText");
    if (footer && footer.textContent !== FOOTER_TEXT) footer.textContent = FOOTER_TEXT;

    document.querySelectorAll(".about-row").forEach(row => {
      const label = row.querySelector("span");
      const value = row.querySelector("strong");
      if (label && value && label.textContent.trim() === "App Version") value.textContent = VERSION;
    });

    try {
      if (typeof activeWalk !== "undefined" && activeWalk && activeWalk.version !== VERSION) {
        activeWalk.version = VERSION;
      }
    } catch (error) {
      console.error("Could not enforce Alpha 6 version.", error);
    }
  }

  function updatePrintedVersion(html) {
    const host = document.createElement("div");
    host.innerHTML = html;

    host.querySelectorAll(".report-meta-grid p").forEach(item => {
      if (item.textContent.trim().startsWith("App Version:")) {
        item.innerHTML = `<strong>App Version:</strong> ${VERSION}`;
      }
    });

    return host.innerHTML;
  }

  function installPacketGuard() {
    const currentBuilder = window.buildProfessionalReportHtml;
    if (typeof currentBuilder !== "function" || currentBuilder.__alpha6Wrapped) return false;

    function alpha6Builder(walk) {
      const output = currentBuilder(walk);
      const expected = Array.isArray(walk && walk.issues) ? walk.issues.length : 0;
      const host = document.createElement("div");
      host.innerHTML = updatePrintedVersion(output);

      const pages = host.querySelectorAll(".work-order-page");
      if (pages.length !== expected && typeof window.buildSprint8WorkOrderPage === "function") {
        host.querySelectorAll(".work-order-page").forEach(page => page.remove());
        const fragment = document.createElement("div");
        fragment.className = "work-order-pages";
        walk.issues.forEach((issue, index) => {
          fragment.insertAdjacentHTML("beforeend", window.buildSprint8WorkOrderPage(walk, issue, index));
        });
        host.appendChild(fragment);
      }

      return host.innerHTML;
    }

    alpha6Builder.__alpha6Wrapped = true;
    window.buildProfessionalReportHtml = alpha6Builder;
    return true;
  }

  enforceVersion();

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    enforceVersion();
    installPacketGuard();
    if (attempts > 50) window.clearInterval(timer);
  }, 100);

  window.addEventListener("pageshow", enforceVersion);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) enforceVersion();
  });
})();