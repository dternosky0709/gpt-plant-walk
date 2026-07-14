(function (global) {
  let resetPending = false;

  async function resetCompletedWalk(options) {
    if (resetPending) return { status: "busy" };
    resetPending = true;

    try {
      await options.clearDraft(options.walkId || null);
      options.clearActiveWalk();
      options.clearForm();
      options.showStart();
      return { status: "reset" };
    } finally {
      resetPending = false;
    }
  }

  global.walkReset = { resetCompletedWalk };
})(typeof window === "undefined" ? globalThis : window);
