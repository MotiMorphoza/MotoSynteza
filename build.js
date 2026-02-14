// build.js
const fs = require('fs');
const path = require('path');

// Import modules
const Logger = require('./build/logger');
const Scanner = require('./build/scanner');
const Hasher = require('./build/hasher');
const HtmlProcessor = require('./build/html-processor');
const ManifestGenerator = require('./build/manifest-generator');
const HeadOrchestrator = require('./build/head-orchestrator');
const Versioning = require('./build/versioning');
const AtomicDeployer = require('./build/atomic-deployer');

/**
 * SUPER BUILD - MotoSynteza Production Build System
 * Deterministic | Atomic | Stable
 */
class SuperBuild {
  constructor() {
    this.logger = new Logger();
    this.scanner = new Scanner(this.logger);
    this.hasher = new Hasher(this.logger);
    this.htmlProcessor = new HtmlProcessor(this.logger);
    this.manifestGenerator = new ManifestGenerator(this.logger);
    this.versioning = new Versioning(this.logger);
    this.deployer = new AtomicDeployer(this.logger);

    this.rootDir = process.cwd();
  }

  build() {
    try {
      this.logger.info('Starting build process');

      // 1. Validate source
      this.validateSource();

      // 2. Init temp
      const tempDir = this.deployer.initTempDir(this.rootDir);

      // 3. Copy source
      this.deployer.copyToTemp(this.rootDir, tempDir);

      // 4. Generate manifest
      const manifestData = this.manifestGenerator.createManifestData(
        this.scanner,
        path.join(tempDir, 'images')
      );

      const manifestPath = path.join(tempDir, 'js', 'image-manifest.js');
      this.manifestGenerator.generate(manifestData, manifestPath);

      const manifestContent = fs.readFileSync(manifestPath, 'utf8');

      // 5. Preliminary version (before hashing)
      const prelimVersion = this.versioning.generateVersion(new Map(), manifestContent);
      this.versioning.createVersionFile(tempDir, prelimVersion);

      // 6. Hash assets
      this.hasher.hashAssets(tempDir, this.scanner);
      const renameMap = this.hasher.getRenameMap();

      // 7. Final version (after hashing)
      const finalVersion = this.versioning.generateVersion(renameMap, manifestContent);

      // Discover hashed version script deterministically
      const jsDir = path.join(tempDir, 'js');
      const jsFiles = fs.readdirSync(jsDir).sort();
      const hashedVersionFile = jsFiles.find(f =>
        /^build-version\.[a-f0-9]{8}\.js$/.test(f)
      );

      if (hashedVersionFile) {
        const hashedVersionPath = path.join(jsDir, hashedVersionFile);
        fs.writeFileSync(
          hashedVersionPath,
          `window.__BUILD_VERSION__ = "${finalVersion}";\n`,
          'utf8'
        );
      }

      // 8. Rewrite HTML asset paths
      const htmlFiles = this.scanner.findHtmlFiles(tempDir);
      this.htmlProcessor.processHtmlFiles(htmlFiles, tempDir, renameMap);

// Rewrite manifest paths after hashing
const manifestFullPath = path.join(tempDir, 'js', 'image-manifest.js');
let manifestJs = fs.readFileSync(manifestFullPath, 'utf8');

for (const [oldPath, newPath] of renameMap.entries()) {
  const escaped = oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'g');
  manifestJs = manifestJs.replace(regex, newPath);
}

fs.writeFileSync(manifestFullPath, manifestJs, 'utf8');

      // 9. Prepare assets object for HeadOrchestrator
      const versionScriptPath = hashedVersionFile
        ? `js/${hashedVersionFile}`
        : null;

      const assets = {
        versionScriptPath,
        cspPolicy:
          "default-src 'self'; img-src 'self' https: data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'"
      };

      // 10. HEAD ORCHESTRATION
      const headOrchestrator = new HeadOrchestrator({
        logger: this.logger,
        renameMap,
        manifestData,
        version: finalVersion,
        assets
      });

      for (const htmlFile of htmlFiles) {
        const filePath = path.join(tempDir, htmlFile);
        let html = fs.readFileSync(filePath, 'utf8');
        html = headOrchestrator.buildHead(html);
        fs.writeFileSync(filePath, html, 'utf8');
      }

      // 11. Verify references
      this.htmlProcessor.verifyReferences(htmlFiles, tempDir);

      // 12. Atomic deploy
      this.deployer.deploy(this.rootDir);

      const docsPath = path.join(this.rootDir, 'docs');
      this.logger.printSummary(docsPath);

    } catch (error) {
      this.logger.error(`Build failed: ${error.message}`);
      this.logger.debug(error.stack);
      this.deployer.cleanup(this.rootDir);
      process.exit(1);
    }
  }

  validateSource() {
    const required = [
      'index.html',
      'css',
      'js',
      'images'
    ];

    for (const item of required) {
      const itemPath = path.join(this.rootDir, item);
      if (!fs.existsSync(itemPath)) {
        throw new Error(`Missing required directory: ${item}`);
      }
    }

    this.logger.info('Source structure validated');
  }
}

if (require.main === module) {
  const build = new SuperBuild();
  build.build();
}

module.exports = SuperBuild;
