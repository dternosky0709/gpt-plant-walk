(() => {
  const VERSION = "v0.9.8-alpha11";

  function updatePrintedVersion(host) {
    host.querySelectorAll(".report-meta-grid p, .report-header p").forEach(item => {
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

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (installFinalPacketBuilder() || attempts >= 80) window.clearInterval(timer);
  }, 100);
})();