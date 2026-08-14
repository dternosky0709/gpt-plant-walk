import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../photo-gallery.js", import.meta.url), "utf8");
const context = { globalThis: {} };
vm.runInNewContext(source, context);

const walks = [
  { id: "active", status: "active", issues: [{ id: "ignored", photos: ["active-photo"] }] },
  { id: "older", status: "completed", completedAt: "2026-08-12T10:00:00Z", issues: [
    { id: "older-issue", workOrderId: "WO-001", photos: ["older-photo-a", "older-photo-b"] }
  ] },
  { id: "newer", status: "completed", completedAt: "2026-08-13T10:00:00Z", issues: [
    { id: "newer-issue", workOrderId: "WO-002", photos: ["newer-photo"] },
    { id: "text-only", workOrderId: "WO-003", photos: [] }
  ] }
];

const photos = context.globalThis.photoGallery.collectGalleryPhotos(walks);
assert.deepEqual(Array.from(photos, item => item.photo), ["newer-photo", "older-photo-b", "older-photo-a"]);
assert.equal(photos[0].walkId, "newer");
assert.equal(photos[0].issueId, "newer-issue");
assert.equal(photos[0].workOrderNumber, "WO-002");
assert.equal(Object.isFrozen(photos), true);
assert.equal(Object.isFrozen(photos[0]), true);
assert.deepEqual(Array.from(context.globalThis.photoGallery.collectGalleryPhotos(null)), []);

console.log("PASS: completed-walk gallery photos are linked to work orders and sorted newest first.");
