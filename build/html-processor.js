// build/html-processor.js
const fs = require('fs');
const path = require('path');

class HtmlProcessor {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Process all HTML files
   */
  processHtmlFiles(htmlFiles, buildDir, renameMap) {
    for (const htmlFile of htmlFiles) {
      const filePath = path.join(buildDir, htmlFile);
      this.processFile(filePath, renameMap, buildDir);
    }
    
    this.logger.updateStats('htmlFiles', htmlFiles.length);
  }

  /**
   * Process single HTML file
   */
  processFile(filePath, renameMap, buildDir) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Verify <head> exists (case-insensitive)
    if (!/<head[^>]*>/i.test(content)) {
      this.logger.error(`Missing <head> tag in ${path.relative(buildDir, filePath)}`);
      throw new Error('HTML file missing <head> tag');
    }
    
    // Update asset references
    content = this.updateAssetReferences(content, renameMap, filePath, buildDir);
    
    fs.writeFileSync(filePath, content, 'utf8');
  }

  /**
   * Update stylesheet and script references
   */
  updateAssetReferences(html, renameMap, htmlFilePath, buildDir) {
    // Process <link rel="stylesheet">
    html = this.updateStylesheets(html, renameMap, htmlFilePath, buildDir);
    
    // Process <script src="">
    html = this.updateScripts(html, renameMap, htmlFilePath, buildDir);
    
    return html;
  }

  updateStylesheets(html, renameMap, htmlFilePath, buildDir) {
    const linkRegex = /<link\s+([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi;
    
    return html.replace(linkRegex, (match, before, href, after) => {
      // Only process stylesheets
      if (!/rel\s*=\s*["']stylesheet["']/i.test(match)) {
        return match;
      }
      
      // Skip external URLs
      if (this.isExternal(href)) {
        return match;
      }
      
      const newHref = this.resolveNewPath(href, renameMap, htmlFilePath, buildDir);
      if (newHref !== href) {
        return `<link ${before}href="${newHref}"${after}>`;
      }
      
      return match;
    });
  }

  updateScripts(html, renameMap, htmlFilePath, buildDir) {
    const scriptRegex = /<script\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi;
    
    return html.replace(scriptRegex, (match, before, src, after) => {
      // Skip external URLs
      if (this.isExternal(src)) {
        return match;
      }
      
      const newSrc = this.resolveNewPath(src, renameMap, htmlFilePath, buildDir);
      if (newSrc !== src) {
        return `<script ${before}src="${newSrc}"${after}>`;
      }
      
      return match;
    });
  }

  isExternal(url) {
    return url.startsWith('http://') || 
           url.startsWith('https://') || 
           url.startsWith('//') ||
           url.startsWith('mailto:') ||
           url.startsWith('data:');
  }

  resolveNewPath(href, renameMap, htmlFilePath, buildDir) {
    // Handle root-relative paths
    let lookupPath = href.startsWith('/') ? href.substring(1) : href;
    
    // Handle relative paths
    if (!href.startsWith('/')) {
      const htmlDir = path.dirname(htmlFilePath);
      const absolutePath = path.resolve(htmlDir, href);
      lookupPath = path.relative(buildDir, absolutePath).replace(/\\/g, '/');
    }
    
    // Check if we have a mapping
    if (renameMap.has(lookupPath)) {
      const newPath = renameMap.get(lookupPath);
      // Return as root-relative if original was root-relative
      return href.startsWith('/') ? `/${newPath}` : newPath;
    }
    
    return href;
  }

  /**
   * Verify all references exist
   */
  verifyReferences(htmlFiles, buildDir) {
    for (const htmlFile of htmlFiles) {
      const filePath = path.join(buildDir, htmlFile);
      const content = fs.readFileSync(filePath, 'utf8');
      
      this.verifyStylesheetReferences(content, filePath, buildDir);
      this.verifyScriptReferences(content, filePath, buildDir);
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

  checkFileExists(href, htmlFilePath, buildDir) {
    let filePath;
    
    if (href.startsWith('/')) {
      filePath = path.join(buildDir, href.substring(1));
    } else {
      const htmlDir = path.dirname(htmlFilePath);
      filePath = path.resolve(htmlDir, href);
    }
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Referenced file does not exist: ${href} (from ${path.relative(buildDir, htmlFilePath)})`);
    }
  }
}

module.exports = HtmlProcessor;
