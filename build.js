// build.js
const fs = require('fs');
const path = require('path');

// Import modules
const Logger = require('./build/logger');
const Scanner = require('./build/scanner');
const Hasher = require('./build/hasher');
const HtmlProcessor = require('./build/html-processor');
const ManifestGenerator = require('./build/manifest-generator');
const HeadOptimizer = require('./build/head-optimizer');
const PreloadInjector = require('./build/preload-injector');
const CspInjector = require('./build/csp-injector');
const Versioning = require('./build/versioning');
const AtomicDeployer = require('./build/atomic-deployer');

/**
 * SUPER BUILD v5 - MotoSynteza Autonomous Production Build System
 * 
 * Zero dependencies | Deterministic | Atomic | CSP-safe
 */
class SuperBuild {
  constructor() {
    this.logger = new Logger();
    this.scanner = new Scanner(this.logger);
    this.hasher = new Hasher(this.logger);
    this.htmlProcessor = new HtmlProcessor(this.logger);
    this.manifestGenerator = new ManifestGenerator(this.logger);
    this.headOptimizer = new HeadOptimizer(this.logger);
    this.preloadInjector = new PreloadInjector(this.logger);
    this.cspInjector = new CspInjector(this.logger);
    this.versioning = new Versioning(this.logger);
    this.deployer = new AtomicDeployer(this.logger);
    
    this.rootDir = process.cwd();
  }

  /**
   * Main build orchestration
   */
  async build() {
    try {
      this.logger.info('Starting build process');

      // Step 1: Validate source structure
      this.validateSource();

      // Step 2: Initialize temp directory
      const tempDir = this.deployer.initTempDir(this.rootDir);

      // Step 3: Copy source to temp
      this.deployer.copyToTemp(this.rootDir, tempDir);

      // Step 4: Generate image manifest
      const manifestData = this.manifestGenerator.createManifestData(
        this.scanner,
        path.join(tempDir, 'images')
      );
      const manifestPath = path.join(tempDir, 'js', 'image-manifest.js');
      this.manifestGenerator.generate(manifestData, manifestPath);

      // Step 5: Generate build version file (before hashing)
      const manifestContent = fs.readFileSync(manifestPath, 'utf8');
      
      // Generate preliminary version (will be regenerated after hashing)
      const prelimVersion = this.versioning.generateVersion(new Map(), manifestContent);
      const versionPath = this.versioning.createVersionFile(tempDir, prelimVersion);

      // Step 6: Hash all CSS and JS assets (including version file)
      this.hasher.hashAssets(tempDir, this.scanner);
      const renameMap = this.hasher.getRenameMap();

      // Step 7: Regenerate version with final rename map
      const finalVersion = this.versioning.generateVersion(renameMap, manifestContent);
      
      // Find and update the hashed version file
      const jsDir = path.join(tempDir, 'js');
      const files = fs.readdirSync(jsDir);
      const hashedVersionFile = files.find(f => /^build-version\.[a-f0-9]{8}\.js$/.test(f));
      
      if (hashedVersionFile) {
        const hashedVersionPath = path.join(jsDir, hashedVersionFile);
        fs.writeFileSync(hashedVersionPath, `window.__BUILD_VERSION__ = "${finalVersion}";\n`, 'utf8');
      }

      // Step 8: Process HTML files (update references)
      const htmlFiles = this.scanner.findHtmlFiles(tempDir);
      this.htmlProcessor.processHtmlFiles(htmlFiles, tempDir, renameMap);

      // Step 9: Inject version script into HTML
      this.versioning.injectVersionScript(htmlFiles, tempDir, versionPath);

      // Step 10: Optimize head tags
      this.headOptimizer.optimizeAll(htmlFiles, tempDir, manifestData);

      // Step 11: Inject preloads
      this.preloadInjector.injectPreloads(
        htmlFiles,
        tempDir,
        renameMap,
        manifestData,
        this.scanner
      );

      // Step 12: Inject strict CSP
      this.cspInjector.injectCsp(htmlFiles, tempDir);

      // Step 13: Verify all references
      this.htmlProcessor.verifyReferences(htmlFiles, tempDir);

      // Step 14: Atomic deployment with rollback protection
      this.deployer.deploy(this.rootDir);

      // Success
      const docsPath = path.join(this.rootDir, 'docs');
      this.logger.printSummary(docsPath);

    } catch (error) {
      this.logger.error(`Build failed: ${error.message}`);
      this.logger.debug(error.stack);
      this.deployer.cleanup(this.rootDir);
      process.exit(1);
    }
  }

  /**
   * Validate required source structure
   */
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
        throw new Error(`Missing required directory: ${item}/`);
      }
    }

    this.logger.info('Source structure validated');
  }
}

// Execute build
if (require.main === module) {
  const build = new SuperBuild();
  build.build();
}

module.exports = SuperBuild;
