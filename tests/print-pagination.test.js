const fs = require("fs");
const path = require("path");

const cssPath = path.join(__dirname, "..", "sprint8.css");
const css = fs.readFileSync(cssPath, "utf8");
const printBlockMatch = css.match(/@media\s+print\s*\{([\s\S]*)\}\s*$/);

if (!printBlockMatch) {
  throw new Error("Print media block was not found in sprint8.css");
}

const printCss = printBlockMatch[1];
const workOrderMatch = printCss.match(/\.work-order-page\s*\{([\s\S]*?)\}/);

if (!workOrderMatch) {
  throw new Error(".work-order-page print rule was not found");
}

const rule = workOrderMatch[1];
const failures = [];

if (/page-break-after\s*:\s*always/i.test(rule) || /break-after\s*:\s*page/i.test(rule)) {
  failures.push("work orders must not force an after-page break when the next work order already forces a before-page break");
}

if (/height\s*:\s*9\.78in/i.test(rule) || /min-height\s*:\s*9\.78in/i.test(rule) || /max-height\s*:\s*9\.78in/i.test(rule)) {
  failures.push("work orders must not use a fixed 9.78in print height because content can overflow onto a second page");
}

if (!/page-break-before\s*:\s*always/i.test(rule) && !/break-before\s*:\s*page/i.test(rule)) {
  failures.push("each work order must still begin on a new page");
}

if (!/height\s*:\s*auto/i.test(rule)) {
  failures.push("work order print height should be content-driven");
}

if (failures.length) {
  console.error("Print pagination regression test failed:");
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("PASS: work-order print pagination uses one page break between work orders and content-driven height.");
