#!/usr/bin/env node

/**
 * SUPER BUILD v3
 * Deterministic, Atomic, Production-Grade
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "docs");
const TEMP_DIR = path.join(ROOT, ".build-temp");

const EXCLUDED_DIRS = ["node_modules", "docs", ".git"];
const HASH_LENGTH = 12;

let stats = {
  hashedFiles: 0,
  htmlUpdated: 0,
  warnings: 0,
  startTime: Date.now(),
};

function fail(message) {
  console.error("BUILD FAILED:", message);
  process.exit(1);
}

function hashContent(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex").slice(0, HASH_LENGTH);
}

function isExcluded(p) {
  return EXCLUDED_DIRS.some(dir => p.includes(dir)) || path.basename(p).startsWith(".");
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function cleanDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function recursiveFiles(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (isExcluded(full)) continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(recursiveFiles(full));
    } else {
      results.push(full);
    }
  }
  return results.sort(); // deterministic
}

function hashAssets(baseDir, exts) {
  const files = recursiveFiles(baseDir).filter(f => exts.includes(path.extname(f)));
  const map = {};
  for (const file of files) {
    const content = fs.readFileSync(file);
    const hash = hashContent(content);
    const dir = path.dirname(file);
    const ext = path.extname(file);
    const name = path.basename(file, ext);
    const hashedName = `${name}.${hash}${ext}`;
    const rel = path.relative(ROOT, file);
    const newRel = path.join(path.dirname(rel), hashedName);
    map[rel.replace(/\\/g, "/")] = newRel.replace(/\\/g, "/");
    stats.hashedFiles++;
  }
  return map;
}

function applyHashing(map) {
  for (const [original, hashed] of Object.entries(map)) {
    const src = path.join(ROOT, original);
    const dest = path.join(TEMP_DIR, hashed);
    copyFile(src, dest);
  }
}

function generateImageManifest() {
  const imagesDir = path.join(ROOT, "images");
  if (!fs.existsSync(imagesDir)) return null;
  const images = recursiveFiles(imagesDir).map(p =>
    path.relative(ROOT, p).replace(/\\/g, "/")
  );
  const manifest = {
    landing: images.filter(i => i.includes("landing")),
    main: images.filter(i => i.includes("main")),
    all: images
  };
  return manifest;
}

function writeManifest(manifest) {
  const content = `window.__IMAGE_MANIFEST__ = ${JSON.stringify(manifest, null, 2)};`;
  const hash = hashContent(Buffer.from(content));
  const fileName = `image-manifest.${hash}.js`;
  const dest = path.join(TEMP_DIR, fileName);
  fs.writeFileSync(dest, content);
  stats.hashedFiles++;
  return fileName;
}

function safeReplaceAssetRefs(html, map) {
  return html.replace(
    /(<script[^>]+src="|<link[^>]+href=")([^"]+)"/g,
    (match, prefix, url) => {
      if (/^(https?:|\/\/)/.test(url)) return match;
      const clean = url.replace(/^\//, "");
      if (map[clean]) {
        return `${prefix}${map[clean]}"`;
      }
      return match;
    }
  );
}

function injectHead(html, preloadAssets) {
  if (!/<meta charset=/.test(html)) {
    html = html.replace(/<head>/, `<head>\n<meta charset="UTF-8">`);
  }

  if (!/theme-color/.test(html)) {
    html = html.replace(/<\/head>/, `<meta name="theme-color" content="#000000">\n</head>`);
  }

  if (!/Content-Security-Policy/.test(html)) {
    html = html.replace(
      /<\/head>/,
      `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' https:; script-src 'self'; style-src 'self'; font-src 'self' https:; object-src 'none';">\n</head>`
    );
  }

  for (const asset of preloadAssets) {
    if (!html.includes(asset)) {
      html = html.replace(
        /<\/head>/,
        `<link rel="preload" href="${asset}" as="${asset.endsWith(".css") ? "style" : "image"}">\n</head>`
      );
    }
  }

  return html;
}

function addVersionStamp(html) {
  const version = Date.now().toString();
  const script = `<script>window.__BUILD_VERSION__="${version}";</script>`;
  return html.replace(/<\/body>/, `${script}\n</body>`);
}

function processHTML(map, manifestFile) {
  const htmlFiles = recursiveFiles(ROOT).filter(f => f.endsWith(".html"));
  for (const file of htmlFiles) {
    let html = fs.readFileSync(file, "utf8");
    html = safeReplaceAssetRefs(html, map);
    html = safeReplaceAssetRefs(html, { "image-manifest.js": manifestFile });
    html = injectHead(html, []);
    html = addVersionStamp(html);
    const dest = path.join(TEMP_DIR, path.relative(ROOT, file));
    ensureDir(path.dirname(dest));
    fs.writeFileSync(dest, html);
    stats.htmlUpdated++;
  }
}

function atomicReplace() {
  cleanDir(OUTPUT_DIR);
  fs.renameSync(TEMP_DIR, OUTPUT_DIR);
}

function copyStatic() {
  const files = recursiveFiles(ROOT).filter(f =>
    !f.endsWith(".html") &&
    !f.endsWith(".js") &&
    !f.endsWith(".css")
  );
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const dest = path.join(TEMP_DIR, rel);
    copyFile(file, dest);
  }
}

function logSummary() {
  const duration = Date.now() - stats.startTime;
  const size = getDirSize(OUTPUT_DIR);
  console.log("Files hashed:", stats.hashedFiles);
  console.log("HTML updated:", stats.htmlUpdated);
  console.log("Build size:", (size / 1024).toFixed(2), "KB");
  console.log("Build time:", duration, "ms");
}

function getDirSize(dir) {
  let total = 0;
  const files = recursiveFiles(dir);
  for (const f of files) total += fs.statSync(f).size;
  return total;
}

/* ===== MAIN ===== */

try {
  cleanDir(TEMP_DIR);
  ensureDir(TEMP_DIR);

  const cssMap = hashAssets(path.join(ROOT, "css"), [".css"]);
  const jsMap = hashAssets(path.join(ROOT, "js"), [".js"]);
  const assetMap = { ...cssMap, ...jsMap };

  applyHashing(assetMap);

  const manifest = generateImageManifest();
  let manifestFile = null;
  if (manifest) {
    manifestFile = writeManifest(manifest);
  }

  processHTML(assetMap, manifestFile);
  copyStatic();
  atomicReplace();
  logSummary();

} catch (err) {
  cleanDir(TEMP_DIR);
  fail(err.message);
}
