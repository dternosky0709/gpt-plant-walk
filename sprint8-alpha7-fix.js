(() => {
  const VERSION = "v0.9.7-alpha10";
  const FOOTER_TEXT = `GPT Plant Walk ${VERSION} — Sprint 8 Alpha 10`;

  function setVersion() {
    const footer = document.getElementById("appVersionText");
    if (footer) footer.textContent = FOOTER_TEXT;

    document.querySelectorAll(".about-row").forEach(row => {
      const label = row.querySelector("span");
      const value = row.querySelector("strong");
      if (label && value && label.textContent.trim() === "App Version") {
        value.textContent = VERSION;
      }
    });

    try {
      if (typeof activeWalk !== "undefined" && activeWalk) activeWalk.version = VERSION;
    } catch (error) {
      console.error("Could not apply Sprint 8 Alpha 10 version.", error);
    }
  }

  function updatePrintedVersion(host) {
    host.querySelectorAll(".report-meta-grid p").forEach(item => {
      if (item.textContent.trim().startsWith("App Version:")) {
        item.innerHTML = `<strong>App Version:</strong> ${VERSION}`;
      }
    });
  }

  function installFinalPacketBuilder() {
    const currentBuilder = window.buildProfessionalReportHtml;
    const pageBuilder = window.buildSprint8WorkOrderPage;
    if (typeof currentBuilder !== "function" || typeof pageBuilder !== "function") return false;
    if (currentBuilder.__alpha10Wrapped) return true;

    function alpha10Builder(walk) {
      const host = document.createElement("div");
      host.innerHTML = currentBuilder(walk);
      updatePrintedVersion(host);

      host.querySelectorAll(
        ".work-order-page, .work-order-pages, .work-order-packet-heading, .work-order-print-terminator, .work-order-packet-complete"
      ).forEach(node => node.remove());

      const issues = Array.isArray(walk && walk.issues) ? walk.issues : [];
      issues.forEach((issue, index) => {
        host.insertAdjacentHTML("beforeend", pageBuilder(walk, issue, index));
      });

      // Safari can omit the last printable node. This invisible forced break protects
      // the final work order without adding a visible completion/test page.
      host.insertAdjacentHTML(
        "beforeend",
        '<div class="work-order-print-terminator" aria-hidden="true">.</div>'
      );

      const generated = host.querySelectorAll(".work-order-page").length;
      if (generated !== issues.length) {
        console.error(`Work order packet mismatch: expected ${issues.length}, generated ${generated}.`);
      }

      return host.innerHTML;
    }

    alpha10Builder.__alpha10Wrapped = true;
    window.buildProfessionalReportHtml = alpha10Builder;
    return true;
  }

  setVersion();

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    setVersion();
    installFinalPacketBuilder();
    if (attempts >= 80) window.clearInterval(timer);
  }, 100);

  window.addEventListener("pageshow", setVersion);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) setVersion();
  });
})();