// build/head-orchestrator.js

/**
 * HeadOrchestrator - Pure <head> controller (NO I/O)
 * Deterministic | Non-destructive | No filesystem access
 */
class HeadOrchestrator {
  constructor({ logger, renameMap, manifestData, version, assets }) {
    this.logger = logger;
    this.renameMap = renameMap;
    this.manifestData = manifestData;
    this.version = version;
    this.assets = assets || {};
  }

  buildHead(html) {
    const headMatch = html.match(/(<head[^>]*>)([\s\S]*?)(<\/head>)/i);
    if (!headMatch) {
      throw new Error('No <head> tag found');
    }

    const [fullHead, openTag, innerContent, closeTag] = headMatch;

    const managedTags = this.buildManagedTags(innerContent);
    const preservedContent = this.removeManagedTags(innerContent);

    const newHead =
      openTag +
      '\n' +
      managedTags.map(t => `  ${t}`).join('\n') +
      (preservedContent.trim() ? '\n' + preservedContent.trim() + '\n' : '\n') +
      closeTag;

    return html.replace(fullHead, newHead);
  }

  buildManagedTags(existingContent) {
    const tags = [];

    // Charset (preserve existing or fallback)
    const charset = this.extractFirst(existingContent, /<meta[^>]*charset[^>]*>/i);
    tags.push(charset || '<meta charset="UTF-8" />');

    // Viewport (preserve)
    const viewport = this.extractFirst(existingContent, /<meta[^>]*name=["']viewport["'][^>]*>/i);
    if (viewport) tags.push(viewport);

    // Theme color (preserve)
    const theme = this.extractFirst(existingContent, /<meta[^>]*name=["']theme-color["'][^>]*>/i);
    if (theme) tags.push(theme);

    // Title (preserve)
    const title = this.extractFirst(existingContent, /<title>[\s\S]*?<\/title>/i);
    if (title) tags.push(title);

    // Canonical (preserve only, do not create)
    const canonical = this.extractFirst(existingContent, /<link[^>]*rel=["']canonical["'][^>]*>/i);
    if (canonical) tags.push(canonical);

    // Stylesheets (preserve order)
    tags.push(...this.extractAll(existingContent, /<link[^>]*rel=["']stylesheet["'][^>]*>/gi));

    // Preload CSS (deterministic from renameMap)
    const cssPreload = this.getCssPreload();
    if (cssPreload) tags.push(cssPreload);

    // Preload image (deterministic via manifest + renameMap)
    const imagePreload = this.getImagePreload();
    if (imagePreload) tags.push(imagePreload);

    // Version script
    if (this.assets.versionScriptPath) {
      tags.push(`<script src="${this.assets.versionScriptPath}"></script>`);
    }

    // Other scripts (preserve, exclude version script)
    const scripts = this.extractAll(
      existingContent,
      /<script[^>]*src=["'][^"']+["'][^>]*><\/script>/gi
    ).filter(s => !/build-version\.[a-f0-9]{8}\.js/i.test(s));

    tags.push(...scripts);

    // CSP (preserve existing or inject from assets)
    const existingCsp = this.extractFirst(
      existingContent,
      /<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i
    );

    if (existingCsp) {
      tags.push(existingCsp);
    } else if (this.assets.cspPolicy) {
      tags.push(
        `<meta http-equiv="Content-Security-Policy" content="${this.assets.cspPolicy}">`
      );
    }

    return tags;
  }

  removeManagedTags(content) {
    const patterns = [
      /<meta[^>]*charset[^>]*>/gi,
      /<meta[^>]*name=["']viewport["'][^>]*>/gi,
      /<meta[^>]*name=["']theme-color["'][^>]*>/gi,
      /<title>[\s\S]*?<\/title>/gi,
      /<link[^>]*rel=["']canonical["'][^>]*>/gi,
      /<link[^>]*rel=["']stylesheet["'][^>]*>/gi,
      /<link[^>]*rel=["']preload["'][^>]*>/gi,
      /<script[^>]*src=["'][^"']+["'][^>]*><\/script>/gi,
      /<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi
    ];

    let cleaned = content;
    for (const pattern of patterns) {
      cleaned = cleaned.replace(pattern, '');
    }

    return cleaned;
  }

  getCssPreload() {
    const sortedEntries = Array.from(this.renameMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]));

    for (const [oldPath, newPath] of sortedEntries) {
      if (oldPath.startsWith('css/') && oldPath.endsWith('.css')) {
        return `<link rel="preload" href="${newPath}" as="style">`;
      }
    }

    return null;
  }

  getImagePreload() {
    if (!this.manifestData) return null;

    const firstImage =
      (this.manifestData.landing && this.manifestData.landing[0]) ||
      (this.manifestData.main && this.manifestData.main[0]);

    if (!firstImage) return null;

    const resolved = this.renameMap.get(firstImage) || firstImage;
    return `<link rel="preload" href="${resolved}" as="image">`;
  }

  extractFirst(content, regex) {
    const match = content.match(regex);
    return match ? match[0] : null;
  }

  extractAll(content, regex) {
    const matches = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      matches.push(match[0]);
    }
    return matches;
  }
}

module.exports = HeadOrchestrator;
