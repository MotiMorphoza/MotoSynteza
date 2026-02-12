#!/usr/bin/env node

/**
 * SUPER BUILD v3 — Autonomous Production Build System
 * Production-grade static site builder for MotoSynteza
 * Node.js core modules only | Atomic | Deterministic | Cache-safe
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  buildName: 'Super Build v3',
  tempDir: '.build-temp',
  backupDir: '.docs-backup',
  outputDir: 'docs',
  
  excludeDirs: ['node_modules', 'docs', '.git', '.build-temp', '.docs-backup'],
  
  assetDirs: ['css', 'js'],
  copyDirs: ['images'],
  htmlFiles: ['index.html', 'main.html', 'projects.html', 'about.html'],
  
  manifestOutput: 'js/image-manifest.js',
  imagesDir: 'images',
  
  hashLength: 8,
  themeColor: '#111111',
  siteName: 'MotoSynteza',
};

// ============================================================================
// UTILITIES
// ============================================================================

const log = {
  info: (msg) => console.log(`[${CONFIG.buildName}] ${msg}`),
  error: (msg) => console.error(`[${CONFIG.buildName}] ${msg}`),
  warn: (msg) => console.warn(`[${CONFIG.buildName}] ${msg}`),
};

function exitWithError(message) {
  log.error('Build failed');
  log.error(message);
  process.exit(1);
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function removeDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

function computeHash(content) {
  return crypto.createHash('md5').update(content).digest('hex').substring(0, CONFIG.hashLength);
}

function stripExistingHash(filename) {
  // Strip pattern: filename.[hash].ext → filename.ext
  return filename.replace(/\.[a-f0-9]{8}(\.[^.]+)$/, '$1');
}

function getTotalSize(dirPath) {
  let total = 0;
  
  function walk(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else {
        total += stat.size;
      }
    }
  }
  
  walk(dirPath);
  return total;
}

// ============================================================================
// RECURSIVE FILE SCANNER
// ============================================================================

function scanDirectory(dirPath, extensions = null) {
  const results = [];
  
  function walk(currentPath) {
    if (!fs.existsSync(currentPath)) return;
    
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      // Skip hidden files and excluded directories
      if (item.startsWith('.') || CONFIG.excludeDirs.includes(item)) {
        continue;
      }
      
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile()) {
        if (!extensions || extensions.includes(path.extname(item))) {
          results.push(fullPath);
        }
      }
    }
  }
  
  walk(dirPath);
  return results.sort(); // Deterministic order
}

// ============================================================================
// MANIFEST GENERATION
// ============================================================================

function generateManifest() {
  const manifest = {
    landing: [],
    main: [],
    projects: [],
  };
  
  const imagesDir = CONFIG.imagesDir;
  
  // Scan landing images
  const landingDir = path.join(imagesDir, 'landing');
  if (fs.existsSync(landingDir)) {
    const files = fs.readdirSync(landingDir)
      .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
      .sort();
    manifest.landing = files;
  }
  
  // Scan main images
  const mainDir = path.join(imagesDir, 'main');
  if (fs.existsSync(mainDir)) {
    const files = fs.readdirSync(mainDir)
      .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
      .sort();
    manifest.main = files;
  }
  
  // Scan projects
  const projectsDir = path.join(imagesDir, 'projects');
  if (fs.existsSync(projectsDir)) {
    const projectFolders = fs.readdirSync(projectsDir)
      .filter(f => fs.statSync(path.join(projectsDir, f)).isDirectory())
      .sort();
    
    for (const folder of projectFolders) {
      const projectPath = path.join(projectsDir, folder);
      const images = fs.readdirSync(projectPath)
        .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
        .sort();
      
      const project = {
        slug: folder,
        title: folder.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        images: images,
      };
      
      // Try to read project.json
      const metaPath = path.join(projectPath, 'project.json');
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          if (meta.title) project.title = meta.title;
          if (meta.description) project.description = meta.description;
        } catch (err) {
          log.warn(`Invalid JSON in ${metaPath}: ${err.message}`);
        }
      }
      
      manifest.projects.push(project);
    }
  }
  
  return manifest;
}

function writeManifest(manifest, outputPath) {
  const content = `window.__MANIFEST__ = ${JSON.stringify(manifest, null, 2)};`;
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, content, 'utf8');
}

// ============================================================================
// ASSET HASHING
// ============================================================================

function hashAssets(tempDir) {
  const renameMap = new Map();
  const usedHashes = new Set();
  
  // Collect all files to hash
  const filesToHash = [];
  for (const dir of CONFIG.assetDirs) {
    const dirPath = path.join(tempDir, dir);
    if (fs.existsSync(dirPath)) {
      const files = scanDirectory(dirPath, ['.css', '.js']);
      filesToHash.push(...files);
    }
  }
  
  // Hash each file
  for (const filePath of filesToHash) {
    const content = fs.readFileSync(filePath, 'utf8');
    const hash = computeHash(content);
    
    const ext = path.extname(filePath);
    const basename = path.basename(filePath, ext);
    const cleanBasename = stripExistingHash(basename + ext).replace(ext, '');
    const dir = path.dirname(filePath);
    
    // Handle hash collisions
    let finalHash = hash;
    let counter = 2;
    while (usedHashes.has(finalHash)) {
      finalHash = hash + '-' + counter;
      counter++;
    }
    usedHashes.add(finalHash);
    
    const newFilename = `${cleanBasename}.${finalHash}${ext}`;
    const newFilePath = path.join(dir, newFilename);
    
    // Store mapping (relative to tempDir for matching)
    const relativeOld = path.relative(tempDir, filePath);
    const relativeNew = path.relative(tempDir, newFilePath);
    renameMap.set(relativeOld, relativeNew);
    
    // Rename file
    fs.renameSync(filePath, newFilePath);
  }
  
  return renameMap;
}

// ============================================================================
// HTML REWRITING
// ============================================================================

function updateHTMLReferences(htmlPath, renameMap, tempDir) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  
  // Update <link rel="stylesheet" href="...">
  html = html.replace(
    /<link\s+([^>]*\s+)?rel=["']stylesheet["']([^>]*\s+)?href=["']([^"']+)["']([^>]*)>/gi,
    (match, before = '', after = '', href, rest = '') => {
      const cleanHref = href.replace(/^\//, ''); // Handle root-relative paths
      
      // Skip external URLs
      if (/^https?:\/\//.test(href)) return match;
      
      // Find in rename map
      for (const [oldPath, newPath] of renameMap.entries()) {
        const normalized = oldPath.replace(/\\/g, '/');
        if (cleanHref === normalized || href === '/' + normalized) {
          const wasRootRelative = href.startsWith('/');
          const updatedHref = wasRootRelative ? '/' + newPath : newPath;
          return `<link ${before}rel="stylesheet"${after}href="${updatedHref}"${rest}>`;
        }
      }
      
      return match;
    }
  );
  
  // Update <script src="..."></script>
  html = html.replace(
    /<script\s+([^>]*\s+)?src=["']([^"']+)["']([^>]*)>(\s*)<\/script>/gi,
    (match, before = '', src, after = '', whitespace = '') => {
      const cleanSrc = src.replace(/^\//, '');
      
      // Skip external URLs
      if (/^https?:\/\//.test(src)) return match;
      
      // Find in rename map
      for (const [oldPath, newPath] of renameMap.entries()) {
        const normalized = oldPath.replace(/\\/g, '/');
        if (cleanSrc === normalized || src === '/' + normalized) {
          const wasRootRelative = src.startsWith('/');
          const updatedSrc = wasRootRelative ? '/' + newPath : newPath;
          return `<script ${before}src="${updatedSrc}"${after}>${whitespace}</script>`;
        }
      }
      
      return match;
    }
  );
  
  fs.writeFileSync(htmlPath, html, 'utf8');
}

// ============================================================================
// HEAD TAG OPTIMIZATION
// ============================================================================

function optimizeHTML(htmlPath, manifest, renameMap, tempDir) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  
  // Verify <head> exists
  if (!/<head[^>]*>/i.test(html)) {
    exitWithError(`Missing <head> tag in ${htmlPath}`);
  }
  
  const headMatch = html.match(/(<head[^>]*>)([\s\S]*?)(<\/head>)/i);
  if (!headMatch) {
    exitWithError(`Malformed <head> tag in ${htmlPath}`);
  }
  
  const [fullHead, openTag, headContent, closeTag] = headMatch;
  const lines = [];
  
  // Collect existing tags
  const hasCharset = /<meta\s+[^>]*charset=/i.test(headContent);
  const hasThemeColor = /<meta\s+[^>]*name=["']theme-color["']/i.test(headContent);
  const hasFavicon = /<link\s+[^>]*rel=["']icon["']/i.test(headContent);
  const hasAppleIcon = /<link\s+[^>]*rel=["']apple-touch-icon["']/i.test(headContent);
  const hasOgTitle = /<meta\s+[^>]*property=["']og:title["']/i.test(headContent);
  const hasOgType = /<meta\s+[^>]*property=["']og:type["']/i.test(headContent);
  const hasOgImage = /<meta\s+[^>]*property=["']og:image["']/i.test(headContent);
  const hasTwitterCard = /<meta\s+[^>]*name=["']twitter:card["']/i.test(headContent);
  const hasTwitterTitle = /<meta\s+[^>]*name=["']twitter:title["']/i.test(headContent);
  const hasCSP = /<meta\s+[^>]*http-equiv=["']Content-Security-Policy["']/i.test(headContent);
  
  // Add missing meta tags
  if (!hasCharset) {
    lines.push('  <meta charset="UTF-8">');
  }
  
  if (!hasThemeColor) {
    lines.push(`  <meta name="theme-color" content="${CONFIG.themeColor}">`);
  }
  
  // Favicon (only if file exists)
  if (!hasFavicon && fileExists(path.join(tempDir, 'images/favicon.ico'))) {
    lines.push('  <link rel="icon" href="images/favicon.ico">');
  }
  
  if (!hasAppleIcon && fileExists(path.join(tempDir, 'images/apple-touch-icon.png'))) {
    lines.push('  <link rel="apple-touch-icon" href="images/apple-touch-icon.png">');
  }
  
  // Open Graph
  if (!hasOgTitle) {
    lines.push(`  <meta property="og:title" content="${CONFIG.siteName}">`);
  }
  
  if (!hasOgType) {
    lines.push('  <meta property="og:type" content="website">');
  }
  
  if (!hasOgImage && manifest.landing && manifest.landing[0]) {
    const ogImage = `images/landing/${manifest.landing[0]}`;
    lines.push(`  <meta property="og:image" content="${ogImage}">`);
  }
  
  // Twitter Card
  if (!hasTwitterCard) {
    lines.push('  <meta name="twitter:card" content="summary_large_image">');
  }
  
  if (!hasTwitterTitle) {
    lines.push(`  <meta name="twitter:title" content="${CONFIG.siteName}">`);
  }
  
  // CSP
  if (!hasCSP) {
    const csp = [
      "default-src 'self'",
      "img-src 'self' https:",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' https:",
      "object-src 'none'",
    ].join('; ');
    lines.push(`  <meta http-equiv="Content-Security-Policy" content="${csp}">`);
  }
  
  // Inject at start of <head>
  if (lines.length > 0) {
    const injection = '\n' + lines.join('\n') + '\n';
    html = html.replace(/(<head[^>]*>)/i, `$1${injection}`);
  }
  
  fs.writeFileSync(htmlPath, html, 'utf8');
}

// ============================================================================
// PRELOAD INJECTION
// ============================================================================

function injectPreloads(htmlPath, manifest, renameMap, tempDir) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  
  const filename = path.basename(htmlPath);
  const preloads = [];
  
  // Find hashed CSS
  const cssFile = renameMap.get('css/style.css');
  if (cssFile && !html.includes(`rel="preload"`)) {
    preloads.push(`  <link rel="preload" href="${cssFile}" as="style">`);
  }
  
  // Preload hero image based on page
  let heroImage = null;
  if (filename === 'index.html' && manifest.landing && manifest.landing[0]) {
    heroImage = `images/landing/${manifest.landing[0]}`;
  } else if (filename === 'main.html' && manifest.main && manifest.main[0]) {
    heroImage = `images/main/${manifest.main[0]}`;
  }
  
  if (heroImage && !html.includes(`href="${heroImage}"`)) {
    preloads.push(`  <link rel="preload" href="${heroImage}" as="image">`);
  }
  
  // Font preloading (scan for .woff2 files)
  const fontFiles = scanDirectory(tempDir, ['.woff2', '.woff']);
  for (const fontPath of fontFiles) {
    const relativePath = path.relative(tempDir, fontPath).replace(/\\/g, '/');
    if (path.extname(fontPath) === '.woff2' && !html.includes(`href="${relativePath}"`)) {
      preloads.push(`  <link rel="preload" href="${relativePath}" as="font" type="font/woff2" crossorigin>`);
    }
  }
  
  // Inject preloads before </head>
  if (preloads.length > 0) {
    const injection = preloads.join('\n') + '\n';
    html = html.replace(/(\s*)<\/head>/i, `\n${injection}$1</head>`);
  }
  
  fs.writeFileSync(htmlPath, html, 'utf8');
}

// ============================================================================
// VERSION STAMP
// ============================================================================

function computeBuildVersion(renameMap, manifest) {
  // Create deterministic hash from rename map + manifest
  const data = JSON.stringify([...renameMap.entries()].sort()) + JSON.stringify(manifest);
  return computeHash(data);
}

function injectVersionStamp(htmlPath, buildVersion) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  
  // Skip if already exists
  if (html.includes('__BUILD_VERSION__')) {
    return;
  }
  
  const versionScript = `\n  <script>\n    window.__BUILD_VERSION__ = "${buildVersion}";\n  </script>\n`;
  html = html.replace(/(\s*)<\/head>/i, `${versionScript}$1</head>`);
  
  fs.writeFileSync(htmlPath, html, 'utf8');
}

// ============================================================================
// COPY DIRECTORY
// ============================================================================

function copyDirectory(src, dest) {
  ensureDir(dest);
  
  const items = fs.readdirSync(src);
  for (const item of items) {
    // Skip hidden and excluded
    if (item.startsWith('.') || CONFIG.excludeDirs.includes(item)) {
      continue;
    }
    
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    const stat = fs.statSync(srcPath);
    
    if (stat.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ============================================================================
// MAIN BUILD PROCESS
// ============================================================================

function build() {
  const startTime = Date.now();
  
  log.info('Starting build...');
  
  // Validate structure
  for (const htmlFile of CONFIG.htmlFiles) {
    if (!fileExists(htmlFile)) {
      exitWithError(`Missing required file: ${htmlFile}`);
    }
  }
  
  for (const dir of [...CONFIG.assetDirs, ...CONFIG.copyDirs]) {
    if (!fileExists(dir)) {
      exitWithError(`Missing required directory: ${dir}/`);
    }
  }
  
  // Step 1: Clean temp directory
  removeDir(CONFIG.tempDir);
  ensureDir(CONFIG.tempDir);
  
  try {
    // Step 2: Copy HTML files
    for (const htmlFile of CONFIG.htmlFiles) {
      fs.copyFileSync(htmlFile, path.join(CONFIG.tempDir, htmlFile));
    }
    
    // Step 3: Copy asset directories
    for (const dir of CONFIG.assetDirs) {
      copyDirectory(dir, path.join(CONFIG.tempDir, dir));
    }
    
    // Step 4: Copy static directories
    for (const dir of CONFIG.copyDirs) {
      copyDirectory(dir, path.join(CONFIG.tempDir, dir));
    }
    
    // Step 5: Generate manifest
    const manifest = generateManifest();
    const manifestPath = path.join(CONFIG.tempDir, CONFIG.manifestOutput);
    writeManifest(manifest, manifestPath);
    
    // Step 6: Hash assets (including manifest)
    const renameMap = hashAssets(CONFIG.tempDir);
    log.info(`Hashed files: ${renameMap.size}`);
    
    // Step 7: Compute build version
    const buildVersion = computeBuildVersion(renameMap, manifest);
    
    // Step 8: Update HTML files
    for (const htmlFile of CONFIG.htmlFiles) {
      const htmlPath = path.join(CONFIG.tempDir, htmlFile);
      
      updateHTMLReferences(htmlPath, renameMap, CONFIG.tempDir);
      optimizeHTML(htmlPath, manifest, renameMap, CONFIG.tempDir);
      injectPreloads(htmlPath, manifest, renameMap, CONFIG.tempDir);
      injectVersionStamp(htmlPath, buildVersion);
    }
    
    log.info(`Updated HTML files: ${CONFIG.htmlFiles.length}`);
    
    // Step 9: Atomic deployment
    removeDir(CONFIG.backupDir);
    
    if (fileExists(CONFIG.outputDir)) {
      fs.renameSync(CONFIG.outputDir, CONFIG.backupDir);
    }
    
    fs.renameSync(CONFIG.tempDir, CONFIG.outputDir);
    removeDir(CONFIG.backupDir);
    
    // Step 10: Success
    const buildTime = Date.now() - startTime;
    const buildSize = getTotalSize(CONFIG.outputDir);
    
    log.info('Build completed successfully');
    log.info(`Build size: ${buildSize} bytes`);
    log.info(`Build time: ${buildTime} ms`);
    log.info(`Build version: ${buildVersion}`);
    
  } catch (err) {
    // Rollback on error
    removeDir(CONFIG.tempDir);
    exitWithError(err.message);
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

build();
