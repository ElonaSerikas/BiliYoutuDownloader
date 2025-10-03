const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { format } = require('date-fns'); // 日期格式化工具

// 日志级别：从低到高
const LOG_LEVELS = { INFO: 0, WARN: 1, ERROR: 2 };

class Logger {
  constructor() {
    // 日志存储路径（系统应用数据目录）
    this.logDir = path.join(app.getPath('userData'), 'logs');
    this.ensureLogDir();
  }

  // 确保日志目录存在
  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  // 生成日志文件名（按天分割）
  getLogFileName() {
    return `log-${format(new Date(), 'yyyy-MM-dd')}.txt`;
  }

  // 写入日志
  writeLog(level, message) {
    const time = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const logLine = `[${time}] [${level}] ${message}\n`;
    const logPath = path.join(this.logDir, this.getLogFileName());

    // 追加写入日志
    fs.appendFileSync(logPath, logLine, 'utf8');

    // 错误级别日志同时输出到控制台
    if (level === 'ERROR') {
      console.error(logLine);
    }
  }

  // 分级日志方法
  info(message) {
    this.writeLog('INFO', message);
  }

  warn(message) {
    this.writeLog('WARN', message);
  }

  error(message, error) {
    const errorDetails = error ? `\nDetails: ${error.stack || error.message}` : '';
    this.writeLog('ERROR', `${message}${errorDetails}`);
  }

  // 导出日志（返回最近7天日志文件路径）
  exportLogs() {
    const files = fs.readdirSync(this.logDir).filter(file => 
      file.startsWith('log-') && file.endsWith('.txt')
    );
    return files.map(file => path.join(this.logDir, file));
  }
}

module.exports = new Logger();