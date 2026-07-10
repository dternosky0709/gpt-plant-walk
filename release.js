const RELEASE_VERSION = "v0.9.9-alpha12";

function applyReleaseVersionToActiveWalk() {
  try {
    if (typeof activeWalk !== "undefined" && activeWalk && activeWalk.version !== RELEASE_VERSION) {
      activeWalk.version = RELEASE_VERSION;
      if (typeof persistWalks === "function") {
        Promise.resolve(persistWalks()).catch(error => console.error("Could not persist release version.", error));
      }
    }
  } catch (error) {
    console.error("Could not apply release version.", error);
  }
}

function appendStylesheet(href, key) {
  if (document.querySelector('link[data-release-asset="' + key + '"]')) return;
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = href;
  stylesheet.dataset.releaseAsset = key;
  document.head.appendChild(stylesheet);
}

function appendScript(src, key, onload) {
  if (document.querySelector('script[data-release-asset="' + key + '"]')) {
    if (onload) onload();
    return;
  }
  const script = document.createElement("script");
  script.src = src;
  script.async = false;
  script.dataset.releaseAsset = key;
  if (onload) script.onload = onload;
  document.body.appendChild(script);
}

function loadReleaseAssets() {
  const build = "0.9.9-alpha12b";
  appendStylesheet("sprint8.css?v=" + build, "sprint8-css");
  appendStylesheet("sprint8-alpha6-fix.css?v=" + build, "sprint8-alpha6-css");
  appendStylesheet("sprint8-alpha7-fix.css?v=" + build, "sprint8-alpha10-css");

  appendScript("sprint8.js?v=" + build, "sprint8-js", function () {
    appendScript("sprint8-alpha7-fix.js?v=" + build, "sprint8-alpha10-js", function () {
      appendScript("sprint9-lockdown.js?v=" + build, "sprint9-lockdown-js");
    });
  });
}

const releaseStartButton = document.getElementById("startWalkBtn");
if (releaseStartButton) {
  releaseStartButton.addEventListener("click", function () {
    window.setTimeout(applyReleaseVersionToActiveWalk, 0);
  });
}

loadReleaseAssets();
window.setTimeout(applyReleaseVersionToActiveWalk, 500);