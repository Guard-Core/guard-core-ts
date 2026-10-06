/* Structured logging setup, the TS port of guard_core/_utils/logging_utils.py
   (JsonFormatter + setup_custom_logging) and the consumer of the
   logFormat / customLogFile config fields (previously parsed but dead).

   - JsonFormatter emits one JSON object per line with the reference's keys
     (timestamp, level, logger, message).
   - setupCustomLogging builds a Logger that writes text or JSON lines to the
     console and, when customLogFile is set, appends the same lines to that
     file (creating the directory when needed). A second call closes the file
     sink installed by the previous call, like the reference replacing its own
     handlers.
   - resolveConfiguredLogger is the adapter entry point: an injected
     config.logger always wins; otherwise a non-default logFormat or a
     customLogFile builds the configured logger; otherwise the plain
     defaultLogger is used.

   File sinks use node:fs through a lazy dynamic import so the module (and
   the whole core) stays loadable in edge runtimes as long as no custom log
   file is configured. */

import type { Logger } from './logger.js';
import { defaultLogger } from './logger.js';
import type { ResolvedSecurityConfig } from './config.js';

export interface LogRecord {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  logger: string;
  message: string;
}

export const DEFAULT_LOGGER_NAME = 'guard_core';

export class JsonFormatter {
  /** One JSON object per line with the reference's exact key set. */
  format(record: LogRecord): string {
    return JSON.stringify({
      timestamp: record.timestamp,
      level: record.level,
      logger: record.logger,
      message: record.message,
    });
  }
}

export function formatTextLog(record: LogRecord): string {
  /* Reference text layout: "[name] asctime - LEVELNAME - message". */
  return `[${record.logger}] ${record.timestamp} - ${record.level} - ${record.message}`;
}

export interface CustomLoggingOptions {
  logFile?: string | null;
  logFormat?: 'text' | 'json';
  loggerName?: string;
}

interface FileSink {
  write(line: string): void;
  close(): void;
}

/* File sinks installed by earlier setupCustomLogging calls on this module
   instance; a new setup closes them (the reference's own-handler sweep). */
let activeFileSink: FileSink | null = null;

async function openFileSink(logFile: string): Promise<FileSink | null> {
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const dir = path.dirname(logFile);
    if (dir && dir !== '.' && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return {
      write(line: string) {
        try {
          fs.appendFileSync(logFile, `${line}\n`);
        } catch (e) {
          /* Console only: routing this through the logger would re-enter
             the sink and recurse on a persistently failing file (the
             reference's FileHandler.handleError does the same). */
          console.warn(`Failed to write to log file ${logFile}: ${e}`);
        }
      },
      close() { /* appendFileSync needs no close; kept for sink symmetry. */ },
    };
  } catch (e) {
    /* Missing node:fs (edge runtime) or unusable path: the reference logs a
       warning and keeps console-only logging. */
    defaultLogger.warn(`Failed to create log file ${logFile}: ${e}`);
    return null;
  }
}

export async function setupCustomLogging(options: CustomLoggingOptions = {}): Promise<Logger> {
  const logFormat = options.logFormat ?? 'text';
  const loggerName = options.loggerName ?? DEFAULT_LOGGER_NAME;
  const formatter = logFormat === 'json' ? new JsonFormatter() : null;

  /* Replace the previous sink before opening a new one. */
  activeFileSink?.close();
  activeFileSink = null;

  const logger: Logger = {
    info: (message, ...args) => emit('info', 'INFO', message, args),
    warn: (message, ...args) => emit('warn', 'WARN', message, args),
    error: (message, ...args) => emit('error', 'ERROR', message, args),
    debug: (message, ...args) => emit('debug', 'DEBUG', message, args),
  };

  function emit(
    consoleMethod: 'info' | 'warn' | 'error' | 'debug',
    level: LogRecord['level'],
    message: string,
    args: unknown[],
  ): void {
    const fullMessage = args.length > 0 ? `${message} ${args.map(String).join(' ')}` : message;
    const record: LogRecord = {
      timestamp: new Date().toISOString(),
      level,
      logger: loggerName,
      message: fullMessage,
    };
    const line = formatter ? formatter.format(record) : formatTextLog(record);
    /* The setup owns its console handler with the configured formatter,
       like the reference installing its own StreamHandler (going through
       defaultLogger would double-prefix every line). */
    console[consoleMethod](line);
    activeFileSink?.write(line);
  }

  if (options.logFile) {
    activeFileSink = await openFileSink(options.logFile);
  }

  return logger;
}

/** Adapter-side logger resolution (D5): make the logFormat / customLogFile
 *  config fields live. An explicitly injected config.logger always wins. */
export async function resolveConfiguredLogger(config: ResolvedSecurityConfig): Promise<Logger> {
  if (config.logger) return config.logger;
  if (config.customLogFile || config.logFormat === 'json') {
    return setupCustomLogging({ logFile: config.customLogFile, logFormat: config.logFormat });
  }
  return defaultLogger;
}
