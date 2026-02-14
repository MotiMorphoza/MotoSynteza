// build/html-processor.js
const fs = require('fs');
const path = require('path');

class HtmlProcessor {
  constructor(logger) {
    this.logger = logger;
  }

  processHtmlFiles(htmlFiles, buildDir, renameMap) {
    for (const htmlFile of htmlFiles) {
      const filePath = path.join(buildDir, htmlFile);
      this.processFile(filePath, renameMap, buildDir);
    }

    this.logger.updateStats('htmlFiles', htmlFiles.length);
  }

  processFile(filePath, renameMap, buildDir) {
    let content = fs.readFileSync(filePath, 'utf8');

    if (!/<head[^>]*>/i.test(content)) {
      this.logger.error(
        `Missing <head> tag in ${path.relative(buildDir, filePath)}`
      );
      throw new Error('HTML file missing <head> tag');
    }

    content = this.updateAssetReferences(
      content,
      renameMap,
      filePath,
      buildDir
    );

    fs.writeFileSync(filePath, content, 'utf8');
  }

  updateAssetReferences(html, renameMap, htmlFilePath, buildDir) {
    html = this.updateStylesheets(html, renameMap, htmlFilePath, buildDir);
    html = this.updateScripts(html, renameMap, htmlFilePath, buildDir);
    html = this.updateImages(html, renameMap, htmlFilePath, buildDir);
    html = this.updateGenericAssets(html, renameMap, htmlFilePath, buildDir);

    return html;
  }

  updateStylesheets(html, renameMap, htmlFilePath, buildDir) {
    const linkRegex = /<link\s+([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi;

    return html.replace(linkRegex, (match, before, href, after) => {
      if (!/rel\s*=\s*["']stylesheet["']/i.test(match)) return match;
      if (this.isExternal(href)) return match;

      const newHref = this.resolveNewPath(
        href,
        renameMap,
        htmlFilePath,
        buildDir
      );

      return newHref !== href
        ? `<link ${before}href="${newHref}"${after}>`
        : match;
    });
  }

  updateScripts(html, renameMap, htmlFilePath, buildDir) {
    const scriptRegex = /<script\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi;

    return html.replace(scriptRegex, (match, before, src, after) => {
      if (this.isExternal(src)) return match;

      const newSrc = this.resolveNewPath(
        src,
        renameMap,
        htmlFilePath,
        buildDir
      );

      return newSrc !== src
        ? `<script ${before}src="${newSrc}"${after}>`
        : match;
    });
  }

  updateImages(html, renameMap, htmlFilePath, buildDir) {
    const imgRegex = /<img\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi;

    return html.replace(imgRegex, (match, before, src, after) => {
      if (this.isExternal(src)) return match;

      const newSrc = this.resolveNewPath(
        src,
        renameMap,
        htmlFilePath,
        buildDir
      );

      return newSrc !== src
        ? `<img ${before}src="${newSrc}"${after}>`
        : match;
    });
  }

  updateGenericAssets(html, renameMap, htmlFilePath, buildDir) {
    const attrRegex = /(href|content)=["']([^"']+)["']/gi;

    return html.replace(attrRegex, (match, attr, value) => {
      if (this.isExternal(value)) return match;

      const newValue = this.resolveNewPath(
        value,
        renameMap,
        htmlFilePath,
        buildDir
      );

      return newValue !== value
        ? `${attr}="${newValue}"`
        : match;
    });
  }

  isExternal(url) {
    return (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('//') ||
      url.startsWith('mailto:') ||
      url.startsWith('data:')
    );
  }

  resolveNewPath(href, renameMap, htmlFilePath, buildDir) {
    let lookupPath = href.startsWith('/') ? href.substring(1) : href;

    if (!href.startsWith('/')) {
      const htmlDir = path.dirname(htmlFilePath);
      const absolutePath = path.resolve(htmlDir, href);
      lookupPath = path
        .relative(buildDir, absolutePath)
        .replace(/\\/g, '/');
    }

    if (renameMap.has(lookupPath)) {
      return renameMap.get(lookupPath);
    }

    return href;
  }

  verifyReferences(htmlFiles, buildDir) {
    for (const htmlFile of htmlFiles) {
      const filePath = path.join(buildDir, htmlFile);
      const content = fs.readFileSync(filePath, 'utf8');

      this.verifyStylesheetReferences(content, filePath, buildDir);
      this.verifyScriptReferences(content, filePath, buildDir);
      this.verifyImageReferences(content, filePath, buildDir);
    }
  }

  verifyStylesheetReferences(html, htmlFilePath, buildDir) {
    const linkRegex = /<link\s+[^>]*?href=["']([^"']+)["'][^>]*?>/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      if (!/rel\s*=\s*["']stylesheet["']/i.test(match[0])) continue;

      const href = match[1];
      if (this.isExternal(href)) continue;

      this.checkFileExists(href, htmlFilePath, buildDir);
    }
  }

  verifyScriptReferences(html, htmlFilePath, buildDir) {
    const scriptRegex = /<script\s+[^>]*?src=["']([^"']+)["'][^>]*?>/gi;
    let match;

    while ((match = scriptRegex.exec(html)) !== null) {
      const src = match[1];
      if (this.isExternal(src)) continue;

      this.checkFileExists(src, htmlFilePath, buildDir);
    }
  }

  verifyImageReferences(html, htmlFilePath, buildDir) {
    const imgRegex = /<img\s+[^>]*?src=["']([^"']+)["'][^>]*?>/gi;
    let match;

    while ((match = imgRegex.exec(html)) !== null) {
      const src = match[1];
      if (this.isExternal(src)) continue;

      this.checkFileExists(src, htmlFilePath, buildDir);
    }
  }

  checkFileExists(href, htmlFilePath, buildDir) {
    let filePath;

    if (href.startsWith('/')) {
      filePath = path.join(buildDir, href.substring(1));
    } else {
      const htmlDir = path.dirname(htmlFilePath);
      filePath = path.resolve(htmlDir, href);
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(
        `Referenced file does not exist: ${href} (from ${path.relative(
          buildDir,
          htmlFilePath
        )})`
      );
    }
  }
}

module.exports = HtmlProcessor;
