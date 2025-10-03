const { EventEmitter } = require('events');

// 全局事件总线，用于跨进程传递错误和状态
class EventBus extends EventEmitter {
  constructor() {
    super();
    // 错误类型常量
    this.ERROR_TYPES = {
      DOWNLOAD_FAILED: 'download_failed',
      PARSE_FAILED: 'parse_failed',
      LOGIN_FAILED: 'login_failed',
      FILE_ACCESS_ERROR: 'file_access_error'
    };
  }

  // 触发错误事件（带错误码和建议）
  emitError(type, details) {
    const errorMap = {
      [this.ERROR_TYPES.DOWNLOAD_FAILED]: {
        code: 'DL001',
        message: '下载失败',
        suggestion: '检查网络连接或尝试更换画质'
      },
      [this.ERROR_TYPES.PARSE_FAILED]: {
        code: 'PS001',
        message: '解析链接失败',
        suggestion: '确认链接有效或更新软件版本'
      },
      [this.ERROR_TYPES.LOGIN_FAILED]: {
        code: 'LG001',
        message: '登录失败',
        suggestion: '检查账号密码或Cookie有效性'
      }
    };

    this.emit('error', {
      ...errorMap[type],
      details: details || '无额外信息'
    });
  }
}

module.exports = new EventBus();