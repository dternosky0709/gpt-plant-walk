(function (global) {
  const pendingWalks = new WeakSet();

  async function deleteSavedIssue({ walk, issueId, confirmDelete, persist }) {
    if (!walk || !Array.isArray(walk.issues)) return { status: "not-found" };
    if (pendingWalks.has(walk)) return { status: "busy" };
    const issueIndex = walk.issues.findIndex(issue => issue.id === issueId);
    if (issueIndex < 0) return { status: "not-found" };
    if (!confirmDelete()) return { status: "cancelled" };

    pendingWalks.add(walk);
    const [deletedIssue] = walk.issues.splice(issueIndex, 1);
    try {
      await persist();
      return { status: "deleted", issue: deletedIssue, index: issueIndex };
    } catch (error) {
      walk.issues.splice(issueIndex, 0, deletedIssue);
      throw error;
    } finally {
      pendingWalks.delete(walk);
    }
  }

  global.issueDeletion = { deleteSavedIssue };
})(typeof window === "undefined" ? globalThis : window);
