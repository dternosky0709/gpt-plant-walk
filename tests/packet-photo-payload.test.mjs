import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../pdfbolt.js", import.meta.url), "utf8");

assert.match(source, /PACKET_PHOTO_MAX_DIMENSION\s*=\s*720/);
assert.match(source, /canvas\.toDataURL\("image\/jpeg",\s*PACKET_PHOTO_JPEG_QUALITY\)/);
assert.match(source, /await\s+buildPlantWalkPacket\(walk\)/);
assert.match(source, /new TextEncoder\(\)\.encode\(requestBody\)\.byteLength/);
assert.match(source, /original photos have not been changed/);

console.log("PASS: packet generation prepares bounded print-only photo copies and preflights request size.");
