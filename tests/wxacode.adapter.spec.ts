/**
 * 微信小程序码前端适配器单元测试
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { 
  getMiniProgramCode, 
  clearWxacodeCache, 
  getWxacodeCacheStats 
} from '../src/adapters/wxacode';

// 模拟微信小程序环境
const mockWx = {
  getStorageSync: jest.fn(),
  setStorageSync: jest.fn(),
  removeStorageSync: jest.fn(),
  getStorageInfoSync: jest.fn(() => ({ keys: [] })),
  reportAnalytics: jest.fn()
};

const mockWxCloud = {
  callFunction: jest.fn()
};

// 模拟全局对象
global.wx = mockWx as any;
global.wx.cloud = mockWxCloud as any;

describe('微信小程序码前端适配器', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 重置存储状态
    mockWx.getStorageSync.mockReturnValue(null);
    mockWx.getStorageInfoSync.mockReturnValue({ keys: [] });
  });

  describe('缓存机制', () => {
    it('应该命中本地缓存时直接返回', async () => {
      // 模拟缓存命中
      const mockCache = {
        url: 'cloud://test-env.test-appid.wxacode/cached-file.jpg',
        expireAt: Date.now() + 24 * 60 * 60 * 1000, // 1天后过期
        createAt: Date.now()
      };
      
      mockWx.getStorageSync.mockReturnValue(JSON.stringify(mockCache));
      
      const result = await getMiniProgramCode('test-sid', 'test-token');
      
      expect(result.url).toBe(mockCache.url);
      expect(result.fromCache).toBe(true);
      expect(result.fallback).toBeUndefined();
      
      // 不应该调用云函数
      expect(mockWxCloud.callFunction).not.toHaveBeenCalled();
    });

    it('应该缓存过期时自动删除并重新生成', async () => {
      // 模拟过期缓存
      const mockCache = {
        url: 'cloud://test-env.test-appid.wxacode/expired-file.jpg',
        expireAt: Date.now() - 24 * 60 * 60 * 1000, // 1天前过期
        createAt: Date.now()
      };
      
      mockWx.getStorageSync.mockReturnValue(JSON.stringify(mockCache));
      
      // 模拟云函数成功
      mockWxCloud.callFunction.mockResolvedValue({
        result: {
          ok: true,
          url: 'cloud://test-env.test-appid.wxacode/new-file.jpg'
        }
      });
      
      const result = await getMiniProgramCode('test-sid', 'test-token');
      
      expect(result.url).toBe('cloud://test-env.test-appid.wxacode/new-file.jpg');
      expect(result.fromCache).toBe(false);
      
      // 应该调用云函数
      expect(mockWxCloud.callFunction).toHaveBeenCalled();
      
      // 应该删除过期缓存
      expect(mockWx.removeStorageSync).toHaveBeenCalled();
    });

    it('应该成功生成后自动缓存结果', async () => {
      // 模拟云函数成功
      mockWxCloud.callFunction.mockResolvedValue({
        result: {
          ok: true,
          url: 'cloud://test-env.test-appid.wxacode/new-file.jpg'
        }
      });
      
      const result = await getMiniProgramCode('test-sid', 'test-token');
      
      expect(result.url).toBe('cloud://test-env.test-appid.wxacode/new-file.jpg');
      expect(result.fromCache).toBe(false);
      
      // 应该设置缓存
      expect(mockWx.setStorageSync).toHaveBeenCalled();
      
      // 验证缓存内容
      const cacheCall = mockWx.setStorageSync.mock.calls[0];
      const cacheKey = cacheCall[0];
      const cacheData = JSON.parse(cacheCall[1]);
      
      expect(cacheKey).toContain('wxacode:test-sid:test-token');
      expect(cacheData.url).toBe('cloud://test-env.test-appid.wxacode/new-file.jpg');
      expect(cacheData.expireAt).toBeGreaterThan(Date.now());
    });
  });

  describe('三层降级机制', () => {
    it('应该配置错误时降级到文本入局码', async () => {
      // 模拟配置错误（如INVALID_PAGE）
      mockWxCloud.callFunction.mockResolvedValue({
        result: {
          ok: false,
          code: 'INVALID_PAGE',
          message: '页面路径不能包含query参数'
        }
      });
      
      const result = await getMiniProgramCode('test-sid', 'test-token');
      
      expect(result.fallback).toBe('code');
      expect(result.error).toBe('页面路径不能包含query参数');
      expect(result.errorCode).toBe('INVALID_PAGE');
      expect(result.url).toBeUndefined();
    });

    it('应该其他错误时直接降级到文本入局码', async () => {
      // 模拟其他错误（如API_LIMIT）
      mockWxCloud.callFunction.mockResolvedValue({
        result: {
          ok: false,
          code: 'API_LIMIT',
          message: '接口调用频率超限'
        }
      });
      
      const result = await getMiniProgramCode('test-sid', 'test-token');
      
      // 直接降级到文本入局码
      expect(result.fallback).toBe('code');
      expect(result.error).toBe('小程序码生成失败，请使用文本入局码');
      expect(result.errorCode).toBe('ALL_FALLBACK_FAILED');
    });

    it('应该网络错误时进行重试', async () => {
      // 模拟网络错误
      mockWxCloud.callFunction
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({
          result: {
            ok: true,
            url: 'cloud://test-env.test-appid.wxacode/retry-success.jpg'
          }
        });
      
      const result = await getMiniProgramCode('test-sid', 'test-token');
      
      expect(result.url).toBe('cloud://test-env.test-appid.wxacode/retry-success.jpg');
      expect(result.fromCache).toBe(false);
      
      // 应该重试了3次
      expect(mockWxCloud.callFunction).toHaveBeenCalledTimes(3);
    });

    it('应该重试次数超限后降级', async () => {
      // 模拟所有重试都失败
      mockWxCloud.callFunction.mockRejectedValue(new Error('Persistent error'));
      
      const result = await getMiniProgramCode('test-sid', 'test-token');
      
      expect(result.fallback).toBe('code');
      expect(result.error).toContain('重试3次后仍然失败');
      expect(result.errorCode).toBe('MAX_RETRY_EXCEEDED');
      
      // 应该重试了3次
      expect(mockWxCloud.callFunction).toHaveBeenCalledTimes(3);
    });
  });

  describe('错误处理', () => {
    it('应该处理云函数返回的错误码', async () => {
      const errorCases = [
        { code: 'NO_PERMISSION', message: '无权限访问' },
        { code: 'INVALID_APPID', message: 'AppID无效' },
        { code: 'TOKEN_EXPIRED', message: 'AccessToken已过期' },
        { code: 'SCENE_TOO_LONG', message: '场景值过长' }
      ];
      
      for (const errorCase of errorCases) {
        mockWxCloud.callFunction.mockResolvedValue({
          result: {
            ok: false,
            code: errorCase.code,
            message: errorCase.message
          }
        });
        
        const result = await getMiniProgramCode('test-sid', 'test-token');
        
        expect(result.fallback).toBe('code');
        expect(result.error).toBe(errorCase.message);
        expect(result.errorCode).toBe(errorCase.code);
      }
    });

    it('应该处理异常情况', async () => {
      // 模拟存储异常
      mockWx.getStorageSync.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      const result = await getMiniProgramCode('test-sid', 'test-token');
      
      expect(result.fallback).toBe('code');
      expect(result.error).toContain('小程序码生成失败');
    });
  });

  describe('缓存管理', () => {
    it('应该能够清除特定缓存', async () => {
      mockWx.getStorageInfoSync.mockReturnValue({
        keys: ['wxacode:test-sid:test-token', 'other:key']
      });
      
      await clearWxacodeCache('test-sid', 'test-token');
      
      expect(mockWx.removeStorageSync).toHaveBeenCalledWith('wxacode:test-sid:test-token');
    });

    it('应该能够清除所有小程序码缓存', async () => {
      mockWx.getStorageInfoSync.mockReturnValue({
        keys: ['wxacode:key1', 'wxacode:key2', 'other:key']
      });
      
      await clearWxacodeCache();
      
      expect(mockWx.removeStorageSync).toHaveBeenCalledTimes(2);
      expect(mockWx.removeStorageSync).toHaveBeenCalledWith('wxacode:key1');
      expect(mockWx.removeStorageSync).toHaveBeenCalledWith('wxacode:key2');
    });

    it('应该能够获取缓存统计信息', () => {
      const mockKeys = ['wxacode:key1', 'wxacode:key2', 'wxacode:key3'];
      mockWx.getStorageInfoSync.mockReturnValue({ keys: mockKeys });
      
      // 模拟混合的缓存状态
      mockWx.getStorageSync
        .mockReturnValueOnce(JSON.stringify({ expireAt: Date.now() + 1000 })) // 有效
        .mockReturnValueOnce(JSON.stringify({ expireAt: Date.now() - 1000 })) // 过期
        .mockReturnValueOnce(null); // 无效
      
      const stats = getWxacodeCacheStats();
      
      expect(stats.total).toBe(3);
      expect(stats.valid).toBe(1);
      expect(stats.expired).toBe(1);
    });
  });

  describe('埋点上报', () => {
    it('应该上报成功埋点', async () => {
      mockWxCloud.callFunction.mockResolvedValue({
        result: {
          ok: true,
          url: 'cloud://test-env.test-appid.wxacode/success.jpg'
        }
      });
      
      await getMiniProgramCode('test-sid', 'test-token');
      
      // 验证埋点调用
      expect(mockWx.reportAnalytics).toHaveBeenCalledWith('wxacode_success', {
        sid: 'test-sid',
        fromCache: 0
      });
    });

    it('应该上报失败埋点', async () => {
      mockWxCloud.callFunction.mockResolvedValue({
        result: {
          ok: false,
          code: 'INVALID_PAGE',
          message: '页面路径错误'
        }
      });
      
      await getMiniProgramCode('test-sid', 'test-token');
      
      // 验证失败埋点
      expect(mockWx.reportAnalytics).toHaveBeenCalledWith('wxacode_fail', {
        code: 'INVALID_PAGE',
        message: '页面路径错误'
      });
      
      // 验证降级埋点
      expect(mockWx.reportAnalytics).toHaveBeenCalledWith('wxacode_fallback', {
        type: 'code'
      });
    });
  });

  describe('参数处理', () => {
    it('应该使用默认页面路径', async () => {
      mockWxCloud.callFunction.mockResolvedValue({
        result: {
          ok: true,
          url: 'cloud://test-env.test-appid.wxacode/test.jpg'
        }
      });
      
      await getMiniProgramCode('test-sid', 'test-token');
      
      const callData = mockWxCloud.callFunction.mock.calls[0][0].data;
      expect(callData.page).toBe('pages/session/join/index');
      expect(callData.envVersion).toBe('release');
    });

    it('应该支持自定义页面路径和环境版本', async () => {
      mockWxCloud.callFunction.mockResolvedValue({
        result: {
          ok: true,
          url: 'cloud://test-env.test-appid.wxacode/test.jpg'
        }
      });
      
      await getMiniProgramCode('test-sid', 'test-token', {
        page: 'pages/custom/index',
        envVersion: 'trial'
      });
      
      const callData = mockWxCloud.callFunction.mock.calls[0][0].data;
      expect(callData.page).toBe('pages/custom/index');
      expect(callData.envVersion).toBe('trial');
    });
  });
});

