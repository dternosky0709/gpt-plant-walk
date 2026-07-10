const RELEASE_VERSION = "v0.8.2-rc1";

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

const releaseStartButton = document.getElementById("startWalkBtn");
if (releaseStartButton) {
  releaseStartButton.addEventListener("click", () => {
    window.setTimeout(applyReleaseVersionToActiveWalk, 0);
  });
}

window.setTimeout(applyReleaseVersionToActiveWalk, 500);
