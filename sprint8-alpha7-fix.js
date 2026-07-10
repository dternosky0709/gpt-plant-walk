(() => {
  const VERSION = "v0.9.5-alpha8";
  const FOOTER_TEXT = `GPT Plant Walk ${VERSION} — Sprint 8 Alpha 8`;

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
      console.error("Could not apply Sprint 8 Alpha 8 version.", error);
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
    if (currentBuilder.__alpha8Wrapped) return true;

    function alpha8Builder(walk) {
      const host = document.createElement("div");
      host.innerHTML = currentBuilder(walk);
      updatePrintedVersion(host);

      host.querySelectorAll(
        ".work-order-page, .work-order-pages, .work-order-packet-heading, .work-order-print-terminator"
      ).forEach(node => node.remove());

      const issues = Array.isArray(walk && walk.issues) ? walk.issues : [];
      issues.forEach((issue, index) => {
        host.insertAdjacentHTML("beforeend", pageBuilder(walk, issue, index));
      });

      // Safari can omit the final page when the last work order is the final printable node.
      // A tiny trailing print node forces the browser to commit the preceding page.
      host.insertAdjacentHTML(
        "beforeend",
        '<div class="work-order-print-terminator" aria-hidden="true">&nbsp;</div>'
      );

      const generated = host.querySelectorAll(".work-order-page").length;
      if (generated !== issues.length) {
        console.error(`Work order packet mismatch: expected ${issues.length}, generated ${generated}.`);
      }

      return host.innerHTML;
    }

    alpha8Builder.__alpha8Wrapped = true;
    window.buildProfessionalReportHtml = alpha8Builder;
    return true;
  }

  setVersion();

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    setVersion();
    installFinalPacketBuilder();
    if (attempts >= 40) window.clearInterval(timer);
  }, 100);

  window.addEventListener("pageshow", setVersion);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) setVersion();
  });
})();