(() => {
  const VERSION = "v0.9.4-alpha7";

  function setVersion() {
    const footer = document.getElementById("appVersionText");
    if (footer) footer.textContent = `GPT Plant Walk ${VERSION} — Sprint 8 Alpha 7`;
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
    if (currentBuilder.__alpha7Wrapped) return true;

    function alpha7Builder(walk) {
      const host = document.createElement("div");
      host.innerHTML = currentBuilder(walk);
      updatePrintedVersion(host);

      host.querySelectorAll(".work-order-page, .work-order-pages, .work-order-packet-heading").forEach(node => node.remove());

      const issues = Array.isArray(walk && walk.issues) ? walk.issues : [];
      issues.forEach((issue, index) => {
        host.insertAdjacentHTML("beforeend", pageBuilder(walk, issue, index));
      });

      const generated = host.querySelectorAll(".work-order-page").length;
      if (generated !== issues.length) {
        console.error(`Work order packet mismatch: expected ${issues.length}, generated ${generated}.`);
      }

      return host.innerHTML;
    }

    alpha7Builder.__alpha7Wrapped = true;
    window.buildProfessionalReportHtml = alpha7Builder;
    return true;
  }

  setVersion();
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    setVersion();
    if (installFinalPacketBuilder() || attempts >= 60) window.clearInterval(timer);
  }, 100);
})();
