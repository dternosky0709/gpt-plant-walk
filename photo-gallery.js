(function (global) {
  "use strict";

  function completedTime(walk) {
    const value = walk.completedAt || walk.endedAt || "";
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function collectGalleryPhotos(walks) {
    if (!Array.isArray(walks)) return [];
    const photos = [];
    walks.filter(walk => walk && walk.status === "completed").forEach(walk => {
      (Array.isArray(walk.issues) ? walk.issues : []).forEach((issue, issueIndex) => {
        (Array.isArray(issue.photos) ? issue.photos : []).forEach((photo, photoIndex) => {
          if (typeof photo !== "string" || !photo) return;
          photos.push(Object.freeze({
            walkId: walk.id,
            issueId: issue.id,
            issueOrder: issueIndex + 1,
            photoIndex,
            photo,
            completedAt: walk.completedAt || walk.endedAt || null,
            workOrderNumber: issue.workOrderId || null,
            sortTime: completedTime(walk)
          }));
        });
      });
    });
    photos.sort((a, b) => b.sortTime - a.sortTime || b.issueOrder - a.issueOrder || b.photoIndex - a.photoIndex);
    return Object.freeze(photos);
  }

  global.photoGallery = Object.freeze({ collectGalleryPhotos });
})(typeof globalThis !== "undefined" ? globalThis : window);
