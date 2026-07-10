const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const js = fs.readFileSync(path.join(root, "sprint8.js"), "utf8");
const css = fs.readFileSync(path.join(root, "sprint8.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(js.includes("buildSprint8PhotoAttachmentPage"), "Missing dedicated photo attachment page builder.");
assert(js.includes("WORK ORDER PHOTO ATTACHMENT"), "Photo attachment title is missing.");
assert(js.includes("issue.photos[0]"), "Photo attachment must use the issue's single photo.");
assert(!js.includes("wo-photo-wrap"), "Work order page must not contain the old photo thumbnail.");
assert(js.includes("buildSprint8WorkOrderPage(walk, issue, index)}${buildSprint8PhotoAttachmentPage"), "Photo attachment must immediately follow its work order.");

assert(css.includes(".photo-attachment-page"), "Missing photo attachment page styles.");
assert(css.includes(".photo-attachment-frame"), "Missing large photo frame styles.");
assert(css.includes("height: 7.35in"), "Print photo frame is not sized for a large, ink-conscious image.");
assert(css.includes("page-break-before: always"), "Photo attachment must start on a new page.");

const photoInput = html.match(/<input id="photoInput"[^>]*>/)?.[0] || "";
assert(photoInput, "Photo input was not found.");
assert(!/\bmultiple\b/.test(photoInput), "Each issue must allow only one photo.");
assert(html.includes("v0.9.1-alpha4"), "Alpha 4 version marker is missing.");

console.log("PASS: one issue produces one work order and, when present, one dedicated photo attachment page.");
