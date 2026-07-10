(() => {
  const VERSION = "v0.9.3-alpha6";

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

  const footer = document.getElementById("appVersionText");
  if (footer) footer.textContent = `GPT Plant Walk ${VERSION} — Sprint 8 Alpha 6`;

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (installPacketGuard() || attempts > 40) window.clearInterval(timer);
  }, 100);
})();
