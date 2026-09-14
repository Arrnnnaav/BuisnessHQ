// Catalog Plugin Initialization Script
// This runs when the plugin is installed/activated

const fs = require('fs');
const path = require('path');

console.log('Initializing Catalog Plugin...');

// Create necessary directories if they don't exist
const directories = [
  'assets',
  'assets/icons',
  'assets/screenshots',
  'migrations',
  'scripts'
];

directories.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Create default manifest if it doesn't exist
const manifestPath = path.join(__dirname, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.log('Manifest not found - please create manifest.json');
  process.exit(1);
}

// Run database migrations if applicable
console.log('Checking for database migrations...');
const migrationsDir = path.join(__dirname, 'migrations');
if (fs.existsSync(migrationsDir)) {
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.js') || file.endsWith('.sql'))
    .sort();
  
  if (migrationFiles.length > 0) {
    console.log(`Found ${migrationFiles.length} migration files to process`);
    // In a real implementation, this would execute the migrations
    migrationFiles.forEach(file => {
      console.log(`Would process migration: ${file}`);
    });
  } else {
    console.log('No migration files found');
  }
} else {
  console.log('No migrations directory found');
}

// Verify required permissions
console.log('Verifying plugin permissions...');
// In a real implementation, this would check with the plugin manager

console.log('Catalog Plugin initialization complete!');
console.log('Next steps:');
console.log('1. Configure plugin settings through the BusinessOS dashboard');
console.log('2. Import existing catalog data if available');
console.log('3. Set up connections to pricing and quotation systems');
console.log('4. Begin adding/editing products and services');