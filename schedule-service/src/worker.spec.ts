import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';

/**
 * Unit tests for worker entrypoint
 * * 
 * These tests verify that the worker entrypoint is properly configured
 * with the correct npm script and TypeScript compilation output.
 */
describe('Worker Entrypoint', () => {
  describe('Worker configuration', () => {
    it('should use correct npm script command', () => {
      // Verify that package.json has the correct worker script
      // (Task 13.4 - Add npm script "start:worker" to package.json)
      const packageJson = require('../package.json');

      expect(packageJson.scripts['start:worker']).toBe('node dist/worker.js');
    });

    it('should compile worker.ts to worker.js', () => {
      // Verify that TypeScript compilation produces worker.js
      const fs = require('fs');
      const path = require('path');

      const workerJsPath = path.join(__dirname, '..', 'dist', 'worker.js');
      const exists = fs.existsSync(workerJsPath);

      expect(exists).toBe(true);
    });

    it('should have worker.ts in src directory', () => {
      // Verify that worker.ts source file exists
      const fs = require('fs');
      const path = require('path');

      const workerTsPath = path.join(__dirname, 'worker.ts');
      const exists = fs.existsSync(workerTsPath);

      expect(exists).toBe(true);
    });

    it('worker.ts should import NotificationModule', () => {
      // Verify that worker.ts imports and uses NotificationModule
      const fs = require('fs');
      const path = require('path');

      const workerTsPath = path.join(__dirname, 'worker.ts');
      const content = fs.readFileSync(workerTsPath, 'utf-8');

      expect(content).toContain("import { NotificationModule } from './notification/notification.module'");
      expect(content).toContain('NestFactory.createApplicationContext(NotificationModule');
    });

    it('worker.ts should configure environment loading', () => {
      // Verify that worker.ts handles environment configuration
      const fs = require('fs');
      const path = require('path');

      const workerTsPath = path.join(__dirname, 'worker.ts');
      const content = fs.readFileSync(workerTsPath, 'utf-8');

      expect(content).toContain('ConfigService');
      expect(content).toContain('REDIS_HOST');
      expect(content).toContain('REDIS_PORT');
      expect(content).toContain('SMTP_HOST');
      expect(content).toContain('SMTP_PORT');
    });

    it('worker.ts should configure logger', () => {
      // Verify that worker.ts configures logging
      const fs = require('fs');
      const path = require('path');

      const workerTsPath = path.join(__dirname, 'worker.ts');
      const content = fs.readFileSync(workerTsPath, 'utf-8');

      expect(content).toContain('Logger');
      expect(content).toContain('NotificationWorker');
    });
  });
});
