(() => {
  const VERSION = "v0.9.6-alpha9";
  const FOOTER_TEXT = `GPT Plant Walk ${VERSION} — Sprint 8 Alpha 9`;

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
      console.error("Could not apply Sprint 8 Alpha 9 version.", error);
    }
  }

  function updatePrintedVersion(host) {
    host.querySelectorAll(".report-meta-grid p").forEach(item => {
      if (item.textContent.trim().startsWith("App Version:")) {
        item.innerHTML = `<strong>App Version:</strong> ${VERSION}`;
      }
    });
  }

  function buildPacketCompletePage(issueCount) {
    return `
      <section class="work-order-packet-complete" aria-label="Work order packet complete">
        <div class="packet-complete-card">
          <p class="packet-complete-kicker">GPT PLANT WALK</p>
          <h2>Work Order Packet Complete</h2>
          <p>${issueCount} work order${issueCount === 1 ? "" : "s"} generated.</p>
        </div>
      </section>`;
  }

  function installFinalPacketBuilder() {
    const currentBuilder = window.buildProfessionalReportHtml;
    const pageBuilder = window.buildSprint8WorkOrderPage;
    if (typeof currentBuilder !== "function" || typeof pageBuilder !== "function") return false;
    if (currentBuilder.__alpha9Wrapped) return true;

    function alpha9Builder(walk) {
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

      // Mobile Safari has repeatedly omitted the final printable node.
      // This real trailing page protects the final work order from being dropped.
      host.insertAdjacentHTML("beforeend", buildPacketCompletePage(issues.length));

      const generated = host.querySelectorAll(".work-order-page").length;
      if (generated !== issues.length) {
        console.error(`Work order packet mismatch: expected ${issues.length}, generated ${generated}.`);
      }

      return host.innerHTML;
    }

    alpha9Builder.__alpha9Wrapped = true;
    window.buildProfessionalReportHtml = alpha9Builder;
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