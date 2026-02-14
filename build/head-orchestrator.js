// build/head-orchestrator.js
const fs = require('fs');
const path = require('path');

/**
 * HeadOrchestrator - Centralized <head> mutation controller
 * 
 * Responsibilities:
 * - Parse <head> block once
 * - Build deterministic internal representation
 * - Generate final <head> with strict ordering
 * - Handle deduplication
 * - Zero external mutations
 */
class HeadOrchestrator {
  constructor({ logger, renameMap, manifestData, version, buildDir, scanner }) {
    this.logger = logger;
    this.renameMap = renameMap;
    this.manifestData = manifestData;
    this.version = version;
    this.buildDir = buildDir;
    this.scanner = scanner;
  }

  /**
   * Build complete <head> block for given HTML file
   * @param {string} html - Full HTML content
   * @param {string} htmlFile - Filename (e.g., 'index.html')
   * @param {string} filePath - Full file path
   * @returns {string} - Updated HTML with rebuilt <head>
   */
  buildHead(html, htmlFile, filePath) {
    // Parse existing <head> block
    const headMatch = html.match(/(<head[^>]*>)([\s\S]*?)(<\/head>)/i);
    if (!headMatch) {
      throw new Error(`No <head> found in ${htmlFile}`);
    }

    const [fullHead, openTag, existingContent, closeTag] = headMatch;

    // Build ordered tag list
    const tags = this.buildOrderedTags(existingContent, htmlFile);

    // Generate final <head> content with controlled whitespace
    const newContent = tags.map(tag => `\n  ${tag}`).join('');

    // Replace <head> block
    return html.replace(fullHead, `${openTag}${newContent}\n${closeTag}`);
  }

  /**
   * Build deterministic ordered tag list
   */
  buildOrderedTags(existingContent, htmlFile) {
    const tags = [];

    // 1. Charset (mandatory, first)
    if (!this.hasTag(existingContent, 'charset')) {
      tags.push('<meta charset="UTF-8">');
    } else {
      tags.push(this.extractTag(existingContent, 'charset'));
    }

    // 2. Viewport (preserve existing or skip)
    if (this.hasTag(existingContent, 'viewport')) {
      tags.push(this.extractTag(existingContent, 'viewport'));
    }

    // 3. Theme color
    if (!this.hasTag(existingContent, 'theme-color')) {
      tags.push('<meta name="theme-color" content="#111111">');
    } else {
      tags.push(this.extractTag(existingContent, 'theme-color'));
    }

    // 4. Title (preserve existing)
    if (this.hasTag(existingContent, '<title')) {
      tags.push(this.extractTag(existingContent, '<title'));
    }

    // 5. Canonical (preserve existing)
    if (this.hasTag(existingContent, 'rel="canonical"')) {
      tags.push(this.extractTag(existingContent, 'rel="canonical"'));
    }

    // 6. Favicon
    const faviconPath = path.join(this.buildDir, 'images', 'favicon.ico');
    if (fs.existsSync(faviconPath)) {
      if (!this.hasTag(existingContent, 'rel="icon"')) {
        tags.push('<link rel="icon" href="/images/favicon.ico">');
      } else {
        tags.push(this.extractTag(existingContent, 'rel="icon"'));
      }
    }

    // 7. Apple touch icon
    const appleTouchPath = path.join(this.buildDir, 'images', 'apple-touch-icon.png');
    if (fs.existsSync(appleTouchPath)) {
      if (!this.hasTag(existingContent, 'apple-touch-icon')) {
        tags.push('<link rel="apple-touch-icon" href="/images/apple-touch-icon.png">');
      } else {
        tags.push(this.extractTag(existingContent, 'apple-touch-icon'));
      }
    }

    // 8. Open Graph tags
    if (!this.hasTag(existingContent, 'og:title')) {
      tags.push('<meta property="og:title" content="MotoSynteza">');
    } else {
      tags.push(this.extractTag(existingContent, 'og:title'));
    }

    if (!this.hasTag(existingContent, 'og:type')) {
      tags.push('<meta property="og:type" content="website">');
    } else {
      tags.push(this.extractTag(existingContent, 'og:type'));
    }

    if (!this.hasTag(existingContent, 'og:image')) {
      if (this.manifestData && this.manifestData.landing && this.manifestData.landing[0]) {
        tags.push(`<meta property="og:image" content="/${this.manifestData.landing[0]}">`);
      }
    } else {
      tags.push(this.extractTag(existingContent, 'og:image'));
    }

    // 9. Twitter Card tags
    if (!this.hasTag(existingContent, 'twitter:card')) {
      tags.push('<meta name="twitter:card" content="summary_large_image">');
    } else {
      tags.push(this.extractTag(existingContent, 'twitter:card'));
    }

    if (!this.hasTag(existingContent, 'twitter:title')) {
      tags.push('<meta name="twitter:title" content="MotoSynteza">');
    } else {
      tags.push(this.extractTag(existingContent, 'twitter:title'));
    }

    // 10. Preload tags (deterministic order)
    tags.push(...this.buildPreloads(htmlFile));

    // 11. Stylesheets (preserve existing, maintain order)
    const stylesheets = this.extractStylesheets(existingContent);
    tags.push(...stylesheets);

    // 12. Version script (hashed)
    const versionScript = this.getVersionScript();
    if (versionScript) {
      tags.push(versionScript);
    }

    // 13. Other scripts (preserve existing, maintain order)
    const scripts = this.extractScripts(existingContent);
    tags.push(...scripts);

    // 14. CSP (must be last in head for maximum compatibility)
    if (!this.hasTag(existingContent, 'Content-Security-Policy')) {
      tags.push(this.generateCspTag());
    } else {
      tags.push(this.extractTag(existingContent, 'Content-Security-Policy'));
    }

    return tags;
  }

  /**
   * Build deterministic preload tags
   */
  buildPreloads(htmlFile) {
    const preloads = [];

    // CSS preload (first CSS file from sorted renameMap)
    const cssPreload = this.getCssPreload();
    if (cssPreload) {
      preloads.push(cssPreload);
    }

    // Image preload (page-specific)
    const imagePreload = this.getImagePreload(htmlFile);
    if (imagePreload) {
      preloads.push(imagePreload);
    }

    // Font preloads (max 2, sorted)
    const fontPreloads = this.getFontPreloads();
    preloads.push(...fontPreloads);

    // Sort all preloads by href for determinism
    return preloads.sort();
  }

  /**
   * Get CSS preload (deterministic)
   */
  getCssPreload() {
    // Sort renameMap entries to ensure deterministic iteration
    const sortedEntries = Array.from(this.renameMap.entries()).sort((a, b) => {
      return a[0].localeCompare(b[0]);
    });

    for (const [oldPath, newPath] of sortedEntries) {
      if (oldPath.startsWith('css/') && oldPath.endsWith('.css')) {
        return `<link rel="preload" href="${newPath}" as="style">`;
      }
    }
    return null;
  }

  /**
   * Get image preload (page-specific)
   */
  getImagePreload(htmlFile) {
    if (!this.manifestData) return null;

    if (htmlFile === 'index.html' && this.manifestData.landing && this.manifestData.landing[0]) {
      return `<link rel="preload" href="${this.manifestData.landing[0]}" as="image">`;
    }

    if (htmlFile === 'main.html' && this.manifestData.main && this.manifestData.main[0]) {
      return `<link rel="preload" href="${this.manifestData.main[0]}" as="image">`;
    }

    return null;
  }

  /**
   * Get font preloads (max 2, deterministic)
   */
  getFontPreloads() {
    const preloads = [];
    
    // Use scanner's deterministic font finder
    const fontFiles = this.scanner.findFonts(this.buildDir, 2);

    for (const fontPath of fontFiles) {
      const ext = path.extname(fontPath).substring(1);
      const relativePath = path.relative(this.buildDir, fontPath).replace(/\\/g, '/');
      preloads.push(`<link rel="preload" href="${relativePath}" as="font" type="font/${ext}" crossorigin>`);
    }

    return preloads;
  }

  /**
   * Get hashed version script tag
   */
  getVersionScript() {
    const jsDir = path.join(this.buildDir, 'js');
    if (!fs.existsSync(jsDir)) return null;

    // Sort to ensure deterministic selection
    const files = fs.readdirSync(jsDir).sort();
    const versionFile = files.find(f => /^build-version\.[a-f0-9]{8}\.js$/.test(f));
    
    if (versionFile) {
      return `<script src="js/${versionFile}"></script>`;
    }

    return null;
  }

  /**
   * Generate CSP meta tag
   */
  generateCspTag() {
    const policy = [
      "default-src 'self'",
      "img-src 'self' https: data:",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' https:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ');

    return `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  }

  /**
   * Extract existing stylesheets (preserve order)
   */
  extractStylesheets(content) {
    const stylesheets = [];
    const linkRegex = /<link\s+[^>]*?rel=["']stylesheet["'][^>]*?>/gi;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      stylesheets.push(match[0]);
    }

    return stylesheets;
  }

  /**
   * Extract existing scripts (preserve order, exclude version script)
   */
  extractScripts(content) {
    const scripts = [];
    const scriptRegex = /<script\s+[^>]*?src=["'][^"']+["'][^>]*?>/gi;
    let match;

    while ((match = scriptRegex.exec(content)) !== null) {
      // Skip version script (will be re-added in correct position)
      if (!/build-version\.[a-f0-9]{8}\.js/i.test(match[0])) {
        scripts.push(match[0]);
      }
    }

    return scripts;
  }

  /**
   * Check if tag exists (case-insensitive)
   */
  hasTag(content, identifier) {
    const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    return regex.test(content);
  }

  /**
   * Extract specific tag (first match)
   */
  extractTag(content, identifier) {
    const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Handle different tag patterns
    let regex;
    if (identifier.includes('=')) {
      // Attribute-based match (e.g., rel="icon")
      regex = new RegExp(`<[^>]*?${escaped}[^>]*?>`, 'i');
    } else {
      // Content-based match (e.g., charset, viewport)
      regex = new RegExp(`<[^>]*?${escaped}[^>]*?>`, 'i');
    }

    const match = content.match(regex);
    return match ? match[0] : '';
  }
}

module.exports = HeadOrchestrator;
