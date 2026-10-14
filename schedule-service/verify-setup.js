/**
 * Verification script for Task 5.1
 * Verifies that all required modules and configurations are in place
 */

const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'src/prisma/prisma.service.ts',
  'src/prisma/prisma.module.ts',
  'src/schedule.module.ts',
  'src/main.ts',
  'src/health/health.controller.ts',
];

const requiredDependencies = [
  '@nestjs/axios',
  '@nestjs/apollo',
  '@nestjs/graphql',
  '@nestjs/config',
  '@apollo/server',
  'axios',
];

console.log('=== Task 5.1 Verification ===\n');

// Check required files
console.log('Checking required files:');
let allFilesExist = true;
for (const file of requiredFiles) {
  const filePath = path.join(__dirname, file);
  const exists = fs.existsSync(filePath);
  console.log(`  ${exists ? '✓' : '✗'} ${file}`);
  if (!exists) allFilesExist = false;
}

// Check package.json for dependencies
console.log('\nChecking dependencies:');
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

let allDepsInstalled = true;
for (const dep of requiredDependencies) {
  const installed = dep in allDeps;
  console.log(`  ${installed ? '✓' : '✗'} ${dep}${installed ? ` (${allDeps[dep]})` : ''}`);
  if (!installed) allDepsInstalled = false;
}

// Check schedule.module.ts for required configurations
console.log('\nChecking schedule.module.ts configurations:');
const scheduleModulePath = path.join(__dirname, 'src/schedule.module.ts');
const scheduleModuleContent = fs.readFileSync(scheduleModulePath, 'utf8');

const checks = [
  { name: 'ConfigModule with validation', pattern: /ConfigModule\.forRoot/ },
  { name: 'DATABASE_URL validation', pattern: /DATABASE_URL/ },
  { name: 'AUTH_SERVICE_URL validation', pattern: /AUTH_SERVICE_URL/ },
  { name: 'GraphQLModule with ApolloDriver', pattern: /GraphQLModule\.forRoot.*ApolloDriver/s },
  { name: 'autoSchemaFile: true', pattern: /autoSchemaFile:\s*true/ },
  { name: 'introspection: true', pattern: /introspection:\s*true/ },
  { name: 'ApolloServerPluginLandingPageLocalDefault', pattern: /ApolloServerPluginLandingPageLocalDefault/ },
  { name: 'HttpModule configuration', pattern: /HttpModule\.registerAsync/ },
  { name: 'PrismaModule import', pattern: /PrismaModule/ },
  { name: 'HealthController', pattern: /HealthController/ },
];

let allConfigsPresent = true;
for (const check of checks) {
  const found = check.pattern.test(scheduleModuleContent);
  console.log(`  ${found ? '✓' : '✗'} ${check.name}`);
  if (!found) allConfigsPresent = false;
}

// Check .env for required variables
console.log('\nChecking .env file:');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const hasDbUrl = /DATABASE_URL=/.test(envContent);
  const hasAuthUrl = /AUTH_SERVICE_URL=/.test(envContent);
  console.log(`  ${hasDbUrl ? '✓' : '✗'} DATABASE_URL`);
  console.log(`  ${hasAuthUrl ? '✓' : '✗'} AUTH_SERVICE_URL`);
} else {
  console.log('  ✗ .env file not found');
}

// Final summary
console.log('\n=== Summary ===');
const allChecksPassed = allFilesExist && allDepsInstalled && allConfigsPresent;
if (allChecksPassed) {
  console.log('✓ All Task 5.1 requirements are met!');
  process.exit(0);
} else {
  console.log('✗ Some requirements are missing. Please review the output above.');
  process.exit(1);
}
