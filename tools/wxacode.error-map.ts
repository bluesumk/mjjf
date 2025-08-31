/**
 * 微信小程序码错误码映射
 * 用于将微信API返回的错误码转换为用户友好的提示信息
 */

export interface WxacodeError {
  code: string;
  message: string;
  userMessage: string;
  solution?: string;
}

export const WXACODE_ERROR_MAP: Record<string, WxacodeError> = {
  // 参数错误
  'INVALID_PARAMS': {
    code: 'INVALID_PARAMS',
    message: '缺少必要参数：sid、token、page',
    userMessage: '参数配置错误',
    solution: '请检查传入的会话ID、邀请令牌和页面路径'
  },
  
  // 页面路径错误
  'INVALID_PAGE': {
    code: 'INVALID_PAGE',
    message: '页面路径不能包含query参数，请使用scene传递参数',
    userMessage: '页面路径格式错误',
    solution: '页面路径不能包含?和参数，参数请通过scene传递'
  },
  
  // 场景值过长
  'SCENE_TOO_LONG': {
    code: 'SCENE_TOO_LONG',
    message: 'scene参数过长，最大32字符',
    userMessage: '场景值过长',
    solution: '请缩短会话ID或邀请令牌长度'
  },
  
  // 权限错误
  'NO_PERMISSION': {
    code: 'NO_PERMISSION',
    message: '无权限访问，请检查小程序配置',
    userMessage: '无权限生成小程序码',
    solution: '请检查小程序AppID配置和云开发权限'
  },
  
  // AppID错误
  'INVALID_APPID': {
    code: 'INVALID_APPID',
    message: 'AppID无效',
    userMessage: '小程序配置错误',
    solution: '请检查小程序的AppID配置'
  },
  
  // AccessToken错误
  'INVALID_ACCESS_TOKEN': {
    code: 'INVALID_ACCESS_TOKEN',
    message: 'AccessToken无效',
    userMessage: '访问令牌无效',
    solution: '请检查云函数的AccessToken配置'
  },
  
  // AccessToken过期
  'TOKEN_EXPIRED': {
    code: 'TOKEN_EXPIRED',
    message: 'AccessToken已过期',
    userMessage: '访问令牌已过期',
    solution: '请重新获取AccessToken'
  },
  
  // 接口调用频率超限
  'API_LIMIT': {
    code: 'API_LIMIT',
    message: '接口调用频率超限',
    userMessage: '请求过于频繁',
    solution: '请稍后再试，或使用缓存的小程序码'
  },
  
  // 微信服务器内部错误
  'INTERNAL_ERROR': {
    code: 'INTERNAL_ERROR',
    message: '微信服务器内部错误',
    userMessage: '微信服务暂时不可用',
    solution: '请稍后再试'
  },
  
  // 云存储上传失败
  'UPLOAD_FAILED': {
    code: 'UPLOAD_FAILED',
    message: '文件上传失败',
    userMessage: '小程序码保存失败',
    solution: '请检查云存储配置和权限'
  },
  
  // 云存储上传错误
  'UPLOAD_ERROR': {
    code: 'UPLOAD_ERROR',
    message: '云存储上传失败',
    userMessage: '小程序码保存失败',
    solution: '请检查网络连接和云存储配置'
  },
  
  // 微信API调用失败
  'WX_API_ERROR': {
    code: 'WX_API_ERROR',
    message: '微信API调用失败',
    userMessage: '微信服务调用失败',
    solution: '请检查网络连接和微信服务状态'
  },
  
  // 内部服务异常
  'INTERNAL_SERVICE_ERROR': {
    code: 'INTERNAL_SERVICE_ERROR',
    message: '内部服务异常',
    userMessage: '服务暂时不可用',
    solution: '请稍后再试，或联系技术支持'
  },
  
  // 未知错误
  'UNKNOWN_ERROR': {
    code: 'UNKNOWN_ERROR',
    message: '未知错误',
    userMessage: '生成失败，未知原因',
    solution: '请重试或联系技术支持'
  }
};

/**
 * 根据错误码获取错误信息
 */
export function getWxacodeError(code: string): WxacodeError {
  return WXACODE_ERROR_MAP[code] || WXACODE_ERROR_MAP['UNKNOWN_ERROR'];
}

/**
 * 根据微信API错误码获取错误信息
 */
export function getWxacodeErrorByWxCode(wxCode: number, wxMsg?: string): WxacodeError {
  const codeMap: Record<number, string> = {
    40001: 'NO_PERMISSION',
    40013: 'INVALID_APPID',
    40014: 'INVALID_ACCESS_TOKEN',
    40015: 'INVALID_PAGE',
    40016: 'SCENE_TOO_LONG',
    40017: 'INVALID_WIDTH',
    40018: 'INVALID_ENV_VERSION',
    41030: 'TOKEN_EXPIRED',
    45009: 'API_LIMIT',
    50001: 'INTERNAL_ERROR'
  };
  
  const code = codeMap[wxCode];
  if (code) {
    return getWxacodeError(code);
  }
  
  return {
    code: 'UNKNOWN_ERROR',
    message: `微信错误(${wxCode}): ${wxMsg || '未知错误'}`,
    userMessage: '微信服务调用失败',
    solution: '请检查网络连接和微信服务状态'
  };
}

/**
 * 判断是否为可重试的错误
 */
export function isRetryableError(code: string): boolean {
  const retryableCodes = [
    'API_LIMIT',
    'INTERNAL_ERROR',
    'WX_API_ERROR',
    'UPLOAD_ERROR',
    'INTERNAL_SERVICE_ERROR'
  ];
  
  return retryableCodes.includes(code);
}

/**
 * 判断是否为配置错误（不可重试）
 */
export function isConfigError(code: string): boolean {
  const configErrorCodes = [
    'INVALID_PARAMS',
    'INVALID_PAGE',
    'SCENE_TOO_LONG',
    'NO_PERMISSION',
    'INVALID_APPID',
    'INVALID_ACCESS_TOKEN',
    'TOKEN_EXPIRED'
  ];
  
  return configErrorCodes.includes(code);
}

