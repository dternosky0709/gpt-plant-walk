const RELEASE_VERSION = "v0.9.1-alpha4";

function applyReleaseVersionToActiveWalk() {
  try {
    if (typeof activeWalk !== "undefined" && activeWalk && activeWalk.version !== RELEASE_VERSION) {
      activeWalk.version = RELEASE_VERSION;
      if (typeof persistWalks === "function") {
        Promise.resolve(persistWalks()).catch(error => {
          console.error("Could not persist release version.", error);
        });
      }
    }
  } catch (error) {
    console.error("Could not apply release version.", error);
  }
}

function loadSprint8Assets() {
  if (!document.querySelector('link[data-sprint8="true"]')) {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "sprint8.css?v=0.9.1-alpha4";
    stylesheet.dataset.sprint8 = "true";
    document.head.appendChild(stylesheet);
  }

  if (!document.querySelector('script[data-sprint8="true"]')) {
    const script = document.createElement("script");
    script.src = "sprint8.js?v=0.9.1-alpha4";
    script.dataset.sprint8 = "true";
    script.defer = true;
    document.body.appendChild(script);
  }
}

const releaseStartButton = document.getElementById("startWalkBtn");
if (releaseStartButton) {
  releaseStartButton.addEventListener("click", () => {
    window.setTimeout(applyReleaseVersionToActiveWalk, 0);
  });
}

loadSprint8Assets();
window.setTimeout(applyReleaseVersionToActiveWalk, 500);
