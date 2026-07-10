const fs = require("fs");
const assert = require("assert");

const css = fs.readFileSync("print-fixes.css", "utf8");
const release = fs.readFileSync("release.js", "utf8");
const sw = fs.readFileSync("sw.js", "utf8");

assert(css.includes(".photo-attachment-page"), "photo attachment page override is missing");
assert(css.includes("page-break-inside: avoid !important"), "attachment page must stay together");
assert(css.includes("height: 4.75in !important"), "photo frame must use the compact print height");
assert(css.includes("max-height: 4.45in !important"), "photo image must be capped below full-page size");
assert(release.includes('v0.9.1-alpha5'), "release version must be alpha5");
assert(release.includes('print-fixes.css?v=0.9.1-alpha5'), "alpha5 print fix stylesheet must load");
assert(sw.includes('gpt-plant-walk-v0-9-1-alpha5'), "service worker cache must be alpha5");
assert(sw.includes('"./print-fixes.css"'), "print fix stylesheet must be cached");

console.log("PASS: photo attachment stays on one sheet and uses a moderate image area.");
