/** 日誌等級 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** Logger 設定 */
export interface LoggerConfig {
  /** 日誌前綴，用於識別不同模組 */
  prefix: string
  /** 是否啟用日誌輸出 */
  enabled: boolean
  /** 最小日誌等級，低於此等級的日誌不會輸出 */
  minLevel?: LogLevel
  /** 是否顯示時間戳 */
  showTimestamp?: boolean
}

/** 日誌等級權重，用於比較等級 */
const LOG_LEVEL_WEIGHTS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

/** 日誌等級對應的樣式 */
const LOG_LEVEL_STYLES: Record<LogLevel, string> = {
  debug: 'color: #6B7280; background: #F3F4F6; padding: 2px 6px; border-radius: 4px;',
  info: 'color: #059669; background: #D1FAE5; padding: 2px 6px; border-radius: 4px;',
  warn: 'color: #D97706; background: #FEF3C7; padding: 2px 6px; border-radius: 4px;',
  error: 'color: #DC2626; background: #FEE2E2; padding: 2px 6px; border-radius: 4px;',
}

/** 判斷是否要輸出這個等級的日誌 */
function shouldLog(config: LoggerConfig, level: LogLevel): boolean {
  if (!config.enabled) return false
  return LOG_LEVEL_WEIGHTS[level] >= LOG_LEVEL_WEIGHTS[config.minLevel ?? 'debug']
}

/** 組合日誌前綴文字 */
function formatPrefix(config: LoggerConfig, level: LogLevel): string {
  const parts: string[] = []

  if (config.showTimestamp) {
    parts.push(`[${new Date().toLocaleTimeString('zh-TW', { hour12: false })}]`)
  }
  if (config.prefix) {
    parts.push(`[${config.prefix}]`)
  }
  parts.push(`[${level}]`)

  return parts.join(' ')
}

/** 建立指定模組專用的 Logger */
export function useLogger(config: LoggerConfig) {
  function log(level: LogLevel, ...args: unknown[]) {
    if (!shouldLog(config, level)) return
    const consoleMethod = console[level] ?? console.log
    consoleMethod(`%c${formatPrefix(config, level)}`, LOG_LEVEL_STYLES[level], ...args)
  }

  return {
    /** 除錯等級日誌 */
    debug: (...args: unknown[]) => log('debug', ...args),
    /** 資訊等級日誌 */
    info: (...args: unknown[]) => log('info', ...args),
    /** 警告等級日誌 */
    warn: (...args: unknown[]) => log('warn', ...args),
    /** 錯誤等級日誌 */
    error: (...args: unknown[]) => log('error', ...args),
  }
}
