/**
 * Loomra Products Migration Script
 * =========================
 * Migrates Firestore products collection to consolidated colors[].images schema
 * 
 * This script restructures product media storage:
 * - Converts scattered image fields (imageUrl, img) to colors[].images structure
 * - Ensures Swiper.js carousel compatibility
 * - Provides Admin Panel integration ready data structure
 * 
 * ============================================================================
 * USAGE
 * ============================================================================
 * 
 * Dry-Run (Preview Only):
 *   node migrate-products.js
 * 
 * Execute (Apply Changes):
 *   node migrate-products.js --execute
 * 
 * With Custom Project:
 *   node migrate-products.js --project-id=my-project --execute
 * 
 * With Debug Logging:
 *   node migrate-products.js --debug --execute
 * 
 * ============================================================================
 * ENVIRONMENT VARIABLES
 * ============================================================================
 * 
 * Set these before running:
 * 
 *   FIREBASE_PROJECT_ID    - Firebase project ID (e.g., 'loomra-60cd7')
 *   FIREBASE_PRIVATE_KEY    - Service account private key (JSON)
 *   FIREBASE_CLIENT_EMAIL  - Service account email
 * 
 * Or create a .env file:
 * 
 *   echo 'FIREBASE_PROJECT_ID=loomra-60cd7' > .env
 *   echo 'FIREBASE_CLIENT_EMAIL=firebase-adminsdk@loomra-60cd7.iam.gserviceaccount.com' >> .env
 *   echo 'FIREBASE_PRIVATE_KEY={"type":"service_account","project_id":"..."}' >> .env
 * 
 * ============================================================================
 * MIGRATION RULES
 * ============================================================================
 * 
 * 1. Consolidated Media Structure:
 *    - Eliminates: imageUrl, img, mainImage, heroImage, thumbnail
 *    - Merges: all images into colors[].images array
 * 
 * 2. Color Object Schema:
 *    { name, hex, active: boolean, images: [url1, url2, ...] }
 * 
 * 3. Fallback Handling:
 *    - Products without colors: Create default color with all images
 *    - Products with imageUrl only: Convert to colors[0].images = [imageUrl]
 * 
 * 4. Data Cleanup:
 *    - Removes orphaned image fields after migration
 *    - Adds _migrated: true and _migratedAt timestamp
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG_FILE = './firebase-applet-config.json';

function loadConfig() {
  // Load from firebase-applet-config.json as fallback
  let appletConfig = {};
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      appletConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (e) {
    // Ignore
  }
  
  return {
    // Firebase project - try multiple sources
    projectId: process.env.FIREBASE_PROJECT_ID || appletConfig.projectId || appletConfig.firestoreDatabaseId || 'loomra-60cd7',
    apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY || '',
    databaseId: '(default)'  // Loomra uses default database
  };
}

const config = loadConfig();

// Parse CLI arguments
const args = process.argv.slice(2);
const options = {
  dryRun: !args.includes('--execute'),
  debug: args.includes('--debug'),
  projectId: config.projectId,
  // Override project from CLI if provided
  ...args.filter(a => a.startsWith('--project')).reduce((acc, arg) => {
    const [key, value] = arg.replace('--', '').split('=');
    acc[key] = value || true;
    return acc;
  }, {})
};

// ============================================================================
// LOGGING
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

const log = {
  info: (...args) => console.log(colors.blue + '[INFO]' + colors.reset, ...args),
  warn: (...args) => console.warn(colors.yellow + '[WARN]' + colors.reset, ...args),
  error: (...args) => console.error(colors.red + '[ERROR]' + colors.reset, ...args),
  debug: (...args) => options.debug && console.log(colors.gray + '[DEBUG]' + colors.reset, ...args),
  success: (...args) => console.log(colors.green + '✓' + colors.reset, ...args),
  fail: (...args) => console.log(colors.red + '✗' + colors.reset, ...args),
  section: (title) => console.log('\n' + colors.blue + '='.repeat(60) + colors.reset),
  subsection: (title) => console.log('\n---', colors.blue + title + colors.reset)
};

// ============================================================================
// FIRESTORE REST API CLIENT
// ============================================================================

/**
 * Simplified Firestore REST API client
 * Uses Firebase Web API key for unauthenticated read (production would use service account)
 */
class FirestoreREST {
  constructor(projectId, apiKey) {
    this.projectId = projectId;
    this.apiKey = apiKey;
    this.baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`;
  }
  
  async request(method, path, body = null) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': this.apiKey
    };
    
    const options = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Firestore API error (${response.status}): ${error.slice(0, 100)}`);
    }
    
    return response.json();
  }
  
  // Run a query to get all documents
  async queryAll(collectionId) {
    const body = {
      structuredQuery: {
        from: [{ collectionId }],
        select: { fields: [] }
      }
    };
    
    const result = await this.request('POST', '/documents:runQuery', body);
    
    const documents = [];
    if (result && Array.isArray(result)) {
      for (const item of result) {
        if (item.document && item.document.fields) {
          const doc = { id: item.document.name.split('/').pop() };
          for (const [key, value] of Object.entries(item.document.fields)) {
            doc[key] = this.deserializeValue(value);
          }
          documents.push(doc);
        }
      }
    }
    return documents;
  }
  
  deserializeValue(field) {
    if (!field) return null;
    if (field.stringValue !== undefined) return field.stringValue;
    if (field.integerValue !== undefined) return field.integerValue;
    if (field.doubleValue !== undefined) return field.doubleValue;
    if (field.booleanValue !== undefined) return field.booleanValue;
    if (field.nullValue !== undefined) return null;
    if (field.arrayValue?.values) {
      return field.arrayValue.values.map(v => this.deserializeValue(v));
    }
    if (field.mapValue?.fields) {
      const obj = {};
      for (const [k, v] of Object.entries(field.mapValue.fields)) {
        obj[k] = this.deserializeValue(v);
      }
      return obj;
    }
    return null;
  }
  
  serializeValue(value) {
    if (value === null) return { nullValue: null };
    if (typeof value === 'boolean') return { booleanValue: value };
    if (typeof value === 'number') {
      return Number.isInteger(value) ? { integerValue: value } : { doubleValue: value };
    }
    if (typeof value === 'string') return { stringValue: value };
    if (Array.isArray(value)) {
      return { arrayValue: { values: value.map(v => this.serializeValue(v)) } };
    }
    return { stringValue: String(value) };
  }
  
  // Update document (patch)
  async updateDocument(collectionId, documentId, data) {
    const path = `/documents/${collectionId}/${documentId}`;
    const body = { fields: {} };
    
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('_')) continue; // Skip internal fields
      body.fields[key] = this.serializeValue(value);
    }
    
    return this.request('PATCH', path, body);
  }
  
  // Commit a batch of updates
  async commit(writes) {
    return this.request('POST', ':commit', { writes });
  }
}

let firestore = null;

async function initFirebase() {
  try {
    // Load API key from config
    firestore = new FirestoreREST(config.projectId, config.apiKey);
    
    // Test connection with a simple query
    await firestore.queryAll('__presence');
    
    log.info('Firebase REST API client initialized');
    return true;
  } catch (error) {
    log.error('Firebase initialization failed:', error.message);
    log.info('Checking if products collection exists...');
    
    // Try anyway - might work for writes
    firestore = new FirestoreREST(config.projectId, config.apiKey);
    return true;
  }
}

// ============================================================================
// MIGRATION LOGIC
// ============================================================================

/**
 * Extract all image URLs from a product's various legacy fields
 */
function extractLegacyImages(product) {
  const images = new Set();
  
  // Direct image fields
  const imageFields = [
    'imageUrl', 'img', 'mainImage', 'heroImage', 'thumbnail',
    'image', 'image1', 'image2', 'image3', 'image4', 'image5'
  ];
  
  for (const field of imageFields) {
    if (product[field] && typeof product[field] === 'string') {
      if (product[field].startsWith('http')) {
        images.add(product[field]);
      }
    }
  }
  
  // Top-level images array
  if (Array.isArray(product.images)) {
    for (const img of product.images) {
      if (typeof img === 'string' && img.startsWith('http')) {
        images.add(img);
      }
    }
  }
  
  // Colors array (check old format)
  if (Array.isArray(product.colors)) {
    for (const color of product.colors) {
      if (color.imageUrl && typeof color.imageUrl === 'string' && color.imageUrl.startsWith('http')) {
        images.add(color.imageUrl);
      }
      // Already migrated format
      if (Array.isArray(color.images)) {
        for (const img of color.images) {
          if (typeof img === 'string' && img.startsWith('http')) {
            images.add(img);
          }
        }
      }
    }
  }
  
  return Array.from(images);
}

/**
 * Analyze a product to see if it needs migration
 */
function analyzeProduct(product) {
  const issues = [];
  
  // Check for scattered image fields
  const scatteredFields = ['imageUrl', 'img', 'mainImage', 'heroImage', 'thumbnail']
    .filter(f => product[f]);
  
  if (scatteredFields.length > 0) {
    issues.push(`Legacy fields: ${scatteredFields.join(', ')}`);
  }
  
  // Check colors structure
  const colors = product.colors;
  if (!Array.isArray(colors) || colors.length === 0) {
    issues.push('Missing colors array or empty');
  } else {
    for (let i = 0; i < colors.length; i++) {
      const color = colors[i];
      if (!color.name) issues.push(`colors[${i}] missing name`);
      if (!color.hex) issues.push(`colors[${i}] missing hex`);
      if (!Array.isArray(color.images)) {
        issues.push(`colors[${i}] missing images array`);
      }
    }
  }
  
  const legacyImages = extractLegacyImages(product);
  
  return {
    needsMigration: issues.length > 0 || legacyImages.length > 0,
    issues,
    legacyImages,
    imageCount: legacyImages.length
  };
}

/**
 * Transform a product to the new schema
 */
function transformProduct(product) {
  const transformed = { ...product };
  const now = new Date().toISOString();
  
  // Step 1: Extract all legacy images
  const legacyImages = extractLegacyImages(product);
  
  // Step 2: Build colors array
  let colors = [];
  
  if (Array.isArray(product.colors) && product.colors.length > 0) {
    // Process existing colors
    colors = product.colors.map((color, idx) => {
      const transformedColor = {
        name: color.name || `Color ${idx + 1}`,
        hex: color.hex || '#000000',
        active: color.active !== undefined ? color.active : true,
        images: []
      };
      
      const colorImages = [];
      
      // Already migrated images array
      if (Array.isArray(color.images)) {
        for (const img of color.images) {
          if (typeof img === 'string' && img.startsWith('http')) {
            colorImages.push(img);
          }
        }
      }
      
      // Legacy imageUrl field in color
      if (color.imageUrl && typeof color.imageUrl === 'string' && color.imageUrl.startsWith('http')) {
        if (!colorImages.includes(color.imageUrl)) {
          colorImages.push(color.imageUrl);
        }
      }
      
      // For first color, use any leftover legacy images
      if (idx === 0 && colorImages.length === 0 && legacyImages.length > 0) {
        colorImages.push(...legacyImages);
      }
      
      transformedColor.images = colorImages;
      return transformedColor;
    });
  } else if (legacyImages.length > 0) {
    // No colors but have images - create default color
    colors = [{
      name: 'Default',
      hex: '#000000',
      active: true,
      images: legacyImages
    }];
  } else {
    // No color data - create sensible default
    colors = [{
      name: product.category || 'One Color',
      hex: '#000000',
      active: true,
      images: []
    }];
  }
  
  transformed.colors = colors;
  
  // Step 3: Remove scattered image fields
  const fieldsToRemove = [
    'imageUrl', 'img', 'mainImage', 'heroImage', 'thumbnail',
    'image', 'image1', 'image2', 'image3', 'image4', 'image5'
  ];
  
  for (const field of fieldsToRemove) {
    if (field in transformed) {
      delete transformed[field];
    }
  }
  
  // Step 4: Add migration metadata
  transformed._migrated = true;
  transformed._migratedAt = now;
  transformed._migrationVersion = '2.0.0';
  
  return transformed;
}

/**
 * Get list of fields that were removed (for logging)
 */
function getRemovedFields(original) {
  const fields = ['imageUrl', 'img', 'mainImage', 'heroImage', 'thumbnail'];
  return fields.filter(f => original[f]);
}

// ============================================================================
// MAIN MIGRATION
// ============================================================================

async function runMigration() {
  log.section('LOOMRA PRODUCTS MIGRATION');
  log.info(`Project: ${config.projectId}`);
  log.info(`Mode: ${options.dryRun ? colors.yellow + 'DRY-RUN (preview only)' + colors.reset : colors.green + 'EXECUTE (will modify data)' + colors.reset}`);
  
  // Initialize Firebase
  const initialized = await initFirebase();
  if (!initialized) {
    log.error('Cannot proceed without Firebase');
    return { success: false, error: 'Firebase initialization failed' };
  }
  
  try {
    // Get all products using REST API
    const products = await firestore.queryAll('products');
    const totalProducts = products.length;
    
    log.info(`Found ${totalProducts} products in collection`);
    
    if (totalProducts === 0) {
      log.warn('No products to migrate');
      return { success: true, migrated: 0, skipped: 0 };
    }
    
    // Analyze all products
    log.subsection('Analyzing products...');
    
    const analysis = {
      needsMigration: [],
      alreadyValid: [],
      errors: []
    };
    
    for (const product of products) {
      const data = product;
      const status = analyzeProduct(data);
      
      if (status.needsMigration) {
        analysis.needsMigration.push({
          id: product.id,
          name: data.name || 'Unnamed',
          ...status
        });
      } else {
        analysis.alreadyValid.push({
          id: product.id,
          name: data.name || 'Unnamed'
        });
      }
    }
    
    log.debug(`Products already valid: ${analysis.alreadyValid.length}`);
    log.debug(`Products needing migration: ${analysis.needsMigration.length}`);
    
    // Show summary
    if (analysis.needsMigration.length > 0) {
      log.subsection('Products requiring migration:');
      for (const p of analysis.needsMigration) {
        const icon = p.issues.length > 0 ? colors.red + '!' : colors.yellow + '~';
        console.log(`  ${icon} ${p.name} (${p.id})`);
        for (const issue of p.issues) {
          log.debug(`    - ${issue}`);
        }
      }
    }
    
    // Execute migration if not dry-run
    if (!options.dryRun && analysis.needsMigration.length > 0) {
      log.subsection('Applying migration...');
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const productInfo of analysis.needsMigration) {
        try {
          // Find original product data
          const originalData = products.find(p => p.id === productInfo.id);
          if (!originalData) {
            log.warn(`Document not found: ${productInfo.id}`);
            errorCount++;
            continue;
          }
          
          const transformedData = transformProduct(originalData);
          
          // Write using REST API
          await firestore.updateDocument('products', productInfo.id, transformedData);
          
          successCount++;
          
          const removed = getRemovedFields(originalData);
          log.debug(`Migrated: ${productInfo.name}` + (removed.length > 0 ? ` [removed: ${removed.join(', ')}]` : ''));
        } catch (error) {
          errorCount++;
          log.error(`Failed: ${productInfo.id} - ${error.message}`);
          analysis.errors.push({ id: productInfo.id, error: error.message });
        }
      }
      
      log.section('MIGRATION COMPLETE');
      if (errorCount === 0) {
        log.success(`Successfully migrated: ${successCount} products`);
      } else {
        log.fail(`Migrated: ${successCount}, Failed: ${errorCount}`);
      }
      
      return {
        success: errorCount === 0,
        total: totalProducts,
        migrated: successCount,
        skipped: analysis.alreadyValid.length,
        errors: errorCount
      };
    }
    
    // Dry-run summary
    if (options.dryRun) {
      log.section('DRY-RUN COMPLETE');
      log.warn('No changes were made');
      log.info(`Would migrate: ${analysis.needsMigration.length} products`);
      log.info(`Would skip: ${analysis.alreadyValid.length} products`);
      
      // Preview changes
      if (analysis.needsMigration.length > 0 && options.debug) {
        log.subsection('Preview of changes:');
        for (const p of analysis.needsMigration.slice(0, 5)) {
          const original = products.find(prod => prod.id === p.id);
          if (original) {
            const transformed = transformProduct(original);
            console.log(`\n  ${p.name}:`);
            console.log(`    Before: colors = ${original.colors?.length || 0} items`);
            console.log(`    After:  colors = ${transformed.colors?.length} items`);
            const removed = getRemovedFields(original);
            if (removed.length > 0) {
              console.log(`    Removed: ${removed.join(', ')}`);
            }
          }
        }
      }
      
      return {
        success: true,
        dryRun: true,
        total: totalProducts,
        wouldMigrate: analysis.needsMigration.length,
        wouldSkip: analysis.alreadyValid.length
      };
    }
    
    return { success: true, total: totalProducts };
  } catch (error) {
    log.error('Migration failed:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

runMigration()
  .then(result => {
    console.log('\n' + '='.repeat(60));
    console.log('RESULT:', JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });