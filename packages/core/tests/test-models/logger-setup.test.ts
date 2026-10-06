import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  JsonFormatter,
  formatTextLog,
  setupCustomLogging,
  resolveConfiguredLogger,
  DEFAULT_LOGGER_NAME,
} from '../../src/models/logger-setup.js';
import { defaultLogger } from '../../src/models/logger.js';
import { createTestConfig } from '../helpers.js';

describe('JsonFormatter', () => {
  it('emits the reference key set as one JSON line', () => {
    const formatter = new JsonFormatter();
    const line = formatter.format({
      timestamp: '2026-10-06T00:00:00.000Z',
      level: 'INFO',
      logger: 'guard_core',
      message: 'hello',
    });
    const parsed = JSON.parse(line) as Record<string, string>;
    expect(Object.keys(parsed)).toEqual(['timestamp', 'level', 'logger', 'message']);
    expect(parsed).toEqual({
      timestamp: '2026-10-06T00:00:00.000Z',
      level: 'INFO',
      logger: 'guard_core',
      message: 'hello',
    });
  });
});

describe('formatTextLog', () => {
  it('uses the reference text layout', () => {
    const line = formatTextLog({
      timestamp: '2026-10-06T00:00:00.000Z',
      level: 'WARN',
      logger: 'guard_core',
      message: 'careful',
    });
    expect(line).toBe('[guard_core] 2026-10-06T00:00:00.000Z - WARN - careful');
  });
});

describe('setupCustomLogging', () => {
  let consoleSpies: ReturnType<typeof mockConsole>;

  function mockConsole() {
    return {
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    };
  }

  beforeEach(() => {
    consoleSpies = mockConsole();
  });

  it('emits text lines in the reference layout by default', async () => {
    const logger = await setupCustomLogging();
    logger.info('plain', 1);
    expect(consoleSpies.info).toHaveBeenCalledTimes(1);
    const line = consoleSpies.info.mock.calls[0][0] as string;
    expect(line).toMatch(/^\[guard_core\] \d{4}-\d{2}-\d{2}T.* - INFO - plain 1$/);
  });

  it('emits JSON lines in json format', async () => {
    const logger = await setupCustomLogging({ logFormat: 'json' });
    logger.warn('structured');
    expect(consoleSpies.warn).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(consoleSpies.warn.mock.calls[0][0] as string) as Record<string, string>;
    expect(parsed.level).toBe('WARN');
    expect(parsed.logger).toBe(DEFAULT_LOGGER_NAME);
    expect(parsed.message).toBe('structured');
    expect(typeof parsed.timestamp).toBe('string');
  });

  it('appends formatted lines to a custom log file (both formats)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'guard-log-'));
    const logFile = join(dir, 'nested', 'guard.log');
    try {
      const textLogger = await setupCustomLogging({ logFile, logFormat: 'text' });
      textLogger.error('to-file');
      expect(existsSync(logFile)).toBe(true);
      expect(readFileSync(logFile, 'utf-8')).toContain(' - ERROR - to-file');

      /* A second setup closes the previous file sink; the new JSON sink
         appends to the same file. */
      const jsonLogger = await setupCustomLogging({ logFile, logFormat: 'json' });
      jsonLogger.error('to-file-json');
      const contents = readFileSync(logFile, 'utf-8');
      expect(contents).toContain('to-file');
      const lines = contents.trim().split('\n');
      expect(JSON.parse(lines[lines.length - 1])).toMatchObject({ level: 'ERROR', message: 'to-file-json' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('emits debug lines through the configured formatter', async () => {
    const logger = await setupCustomLogging({ logFormat: 'json' });
    logger.debug('tiny');
    expect(consoleSpies.debug).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(consoleSpies.debug.mock.calls[0][0] as string) as Record<string, string>;
    expect(parsed).toMatchObject({ level: 'DEBUG', message: 'tiny' });
  });

  it('warns and keeps console logging when a write to the file fails', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'guard-log-'));
    const logFile = join(dir, 'guard.log');
    try {
      const logger = await setupCustomLogging({ logFile });
      logger.info('bootstrap');
      /* Replace the file with a directory: appendFileSync now fails. */
      rmSync(logFile);
      mkdirSync(logFile);
      logger.error('boom');
      expect(consoleSpies.error).toHaveBeenCalledTimes(1);
      expect(consoleSpies.warn).toHaveBeenCalled();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps console logging when the file sink cannot be opened', async () => {
    const warns: string[] = [];
    const logger = await setupCustomLogging({ logFile: '/proc/definitely/not/writable/guard.log' });
    /* Patch after setup: the setup warning went through defaultLogger. */
    const origWarn = logger.warn;
    logger.warn = (m: string) => { warns.push(m); origWarn.call(logger, m); };
    logger.info('still-logs');
    expect(consoleSpies.info).toHaveBeenCalled();
    expect(warns.length).toBe(0);
  });
});

describe('resolveConfiguredLogger', () => {
  let consoleSpies: ReturnType<typeof vi.spyOn>[];

  beforeEach(() => {
    consoleSpies = [
      vi.spyOn(console, 'info').mockImplementation(() => {}),
      vi.spyOn(console, 'warn').mockImplementation(() => {}),
      vi.spyOn(console, 'error').mockImplementation(() => {}),
      vi.spyOn(console, 'debug').mockImplementation(() => {}),
    ];
  });

  it('returns the injected config.logger when present', async () => {
    const injected = { info() {}, warn() {}, error() {}, debug() {} };
    const resolved = await resolveConfiguredLogger(createTestConfig({ logger: injected }));
    expect(resolved).toBe(injected);
  });

  it('returns the defaultLogger for the default text config', async () => {
    const resolved = await resolveConfiguredLogger(createTestConfig({}));
    expect(resolved).toBe(defaultLogger);
  });

  it('builds a JSON logger when logFormat is json (D5 logFormat consumer)', async () => {
    const resolved = await resolveConfiguredLogger(createTestConfig({ logFormat: 'json' }));
    resolved.info('json-line');
    const infoSpy = consoleSpies[0] as ReturnType<typeof vi.spyOn>;
    const line = infoSpy.mock.calls[0][0] as string;
    expect(() => JSON.parse(line)).not.toThrow();
    expect(JSON.parse(line)).toMatchObject({ level: 'INFO', message: 'json-line' });
  });

  it('builds a file-writing logger when customLogFile is set (D5 consumer)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'guard-log-'));
    const logFile = join(dir, 'guard.log');
    try {
      const resolved = await resolveConfiguredLogger(createTestConfig({ customLogFile: logFile }));
      resolved.warn('file-line');
      expect(readFileSync(logFile, 'utf-8')).toContain(' - WARN - file-line');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
