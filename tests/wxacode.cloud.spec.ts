/**
 * 微信小程序码云函数单元测试
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// 模拟云函数环境
const mockCloud = {
  init: jest.fn(),
  openapi: {
    wxacode: {
      getUnlimited: jest.fn()
    }
  },
  uploadFile: jest.fn(),
  database: jest.fn(() => ({
    collection: jest.fn(() => ({
      where: jest.fn(() => ({
        get: jest.fn()
      })),
      add: jest.fn()
    }))
  }))
};

// 模拟云函数上下文
const mockContext = {
  OPENID: 'test-openid',
  APPID: 'test-appid',
  UNIONID: 'test-unionid'
};

// 导入云函数（需要模拟）
jest.mock('wx-server-sdk', () => mockCloud);

describe('微信小程序码云函数', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('参数验证', () => {
    it('应该验证必要参数', async () => {
      const { main } = require('../cloudfunctions/wxacode/index.js');
      
      const result = await main({}, mockContext);
      
      expect(result.ok).toBe(false);
      expect(result.code).toBe('INVALID_PARAMS');
      expect(result.message).toContain('缺少必要参数');
    });

    it('应该拒绝包含query参数的page', async () => {
      const { main } = require('../cloudfunctions/wxacode/index.js');
      
      const result = await main({
        sid: 'test-sid',
        token: 'test-token',
        page: 'pages/test/index?param=value'
      }, mockContext);
      
      expect(result.ok).toBe(false);
      expect(result.code).toBe('INVALID_PAGE');
      expect(result.message).toContain('不能包含query参数');
    });
  });

  describe('scene参数生成', () => {
    it('应该生成正确格式的scene参数', async () => {
      const { main } = require('../cloudfunctions/wxacode/index.js');
      
      // 模拟成功的微信API调用
      mockCloud.openapi.wxacode.getUnlimited.mockResolvedValue({
        buffer: Buffer.from('fake-image-data')
      });
      
      // 模拟成功的云存储上传
      mockCloud.uploadFile.mockResolvedValue({
        fileID: 'cloud://test-env.test-appid.wxacode/test-file.jpg'
      });
      
      // 模拟缓存查询失败
      mockCloud.database().collection().where().get.mockResolvedValue({
        data: []
      });
      
      const result = await main({
        sid: 'test-session-id-123456',
        token: 'test-token-123456',
        page: 'pages/session/join/index'
      }, mockContext);
      
      expect(result.ok).toBe(true);
      expect(result.url).toContain('cloud://');
      
      // 验证scene参数格式
      expect(mockCloud.openapi.wxacode.getUnlimited).toHaveBeenCalledWith(
        expect.objectContaining({
          scene: 's=123456&t=test-t',
          page: 'pages/session/join/index',
          check_path: false,
          env_version: 'release',
          width: 280
        })
      );
    });

    it('应该拒绝过长的scene参数', async () => {
      const { main } = require('../cloudfunctions/wxacode/index.js');
      
      const result = await main({
        sid: 'very-long-session-id-that-exceeds-the-limit',
        token: 'very-long-token-that-exceeds-the-limit',
        page: 'pages/session/join/index'
      }, mockContext);
      
      expect(result.ok).toBe(false);
      expect(result.code).toBe('SCENE_TOO_LONG');
    });
  });

  describe('缓存机制', () => {
    it('应该命中缓存时直接返回', async () => {
      const { main } = require('../cloudfunctions/wxacode/index.js');
      
      // 模拟缓存命中
      mockCloud.database().collection().where().get.mockResolvedValue({
        data: [{
          url: 'cloud://test-env.test-appid.wxacode/cached-file.jpg'
        }]
      });
      
      const result = await main({
        sid: 'test-sid',
        token: 'test-token',
        page: 'pages/session/join/index'
      }, mockContext);
      
      expect(result.ok).toBe(true);
      expect(result.url).toBe('cloud://test-env.test-appid.wxacode/cached-file.jpg');
      expect(result.fromCache).toBe(true);
      
      // 不应该调用微信API
      expect(mockCloud.openapi.wxacode.getUnlimited).not.toHaveBeenCalled();
    });

    it('应该缓存未命中时生成新的小程序码', async () => {
      const { main } = require('../cloudfunctions/wxacode/index.js');
      
      // 模拟缓存未命中
      mockCloud.database().collection().where().get.mockResolvedValue({
        data: []
      });
      
      // 模拟成功的微信API调用
      mockCloud.openapi.wxacode.getUnlimited.mockResolvedValue({
        buffer: Buffer.from('fake-image-data')
      });
      
      // 模拟成功的云存储上传
      mockCloud.uploadFile.mockResolvedValue({
        fileID: 'cloud://test-env.test-appid.wxacode/new-file.jpg'
      });
      
      const result = await main({
        sid: 'test-sid',
        token: 'test-token',
        page: 'pages/session/join/index'
      }, mockContext);
      
      expect(result.ok).toBe(true);
      expect(result.fromCache).toBe(false);
      
      // 应该调用微信API和云存储
      expect(mockCloud.openapi.wxacode.getUnlimited).toHaveBeenCalled();
      expect(mockCloud.uploadFile).toHaveBeenCalled();
    });
  });

  describe('错误处理', () => {
    it('应该处理微信API错误', async () => {
      const { main } = require('../cloudfunctions/wxacode/index.js');
      
      // 模拟缓存未命中
      mockCloud.database().collection().where().get.mockResolvedValue({
        data: []
      });
      
      // 模拟微信API错误
      mockCloud.openapi.wxacode.getUnlimited.mockResolvedValue({
        errCode: 40001,
        errMsg: 'invalid credential'
      });
      
      const result = await main({
        sid: 'test-sid',
        token: 'test-token',
        page: 'pages/session/join/index'
      }, mockContext);
      
      expect(result.ok).toBe(false);
      expect(result.code).toBe('NO_PERMISSION');
      expect(result.message).toContain('无权限访问');
    });

    it('应该处理云存储上传失败', async () => {
      const { main } = require('../cloudfunctions/wxacode/index.js');
      
      // 模拟缓存未命中
      mockCloud.database().collection().where().get.mockResolvedValue({
        data: []
      });
      
      // 模拟成功的微信API调用
      mockCloud.openapi.wxacode.getUnlimited.mockResolvedValue({
        buffer: Buffer.from('fake-image-data')
      });
      
      // 模拟云存储上传失败
      mockCloud.uploadFile.mockRejectedValue(new Error('Upload failed'));
      
      const result = await main({
        sid: 'test-sid',
        token: 'test-token',
        page: 'pages/session/join/index'
      }, mockContext);
      
      expect(result.ok).toBe(false);
      expect(result.code).toBe('UPLOAD_ERROR');
      expect(result.message).toContain('云存储上传失败');
    });

    it('应该处理内部异常', async () => {
      const { main } = require('../cloudfunctions/wxacode/index.js');
      
      // 模拟缓存查询异常
      mockCloud.database().collection().where().get.mockRejectedValue(
        new Error('Database error')
      );
      
      const result = await main({
        sid: 'test-sid',
        token: 'test-token',
        page: 'pages/session/join/index'
      }, mockContext);
      
      expect(result.ok).toBe(false);
      expect(result.code).toBe('INTERNAL_ERROR');
      expect(result.message).toContain('内部服务异常');
    });
  });

  describe('环境版本配置', () => {
    it('应该支持不同的环境版本', async () => {
      const { main } = require('../cloudfunctions/wxacode/index.js');
      
      // 模拟成功的调用
      mockCloud.openapi.wxacode.getUnlimited.mockResolvedValue({
        buffer: Buffer.from('fake-image-data')
      });
      mockCloud.uploadFile.mockResolvedValue({
        fileID: 'cloud://test-env.test-appid.wxacode/test-file.jpg'
      });
      mockCloud.database().collection().where().get.mockResolvedValue({
        data: []
      });
      
      const result = await main({
        sid: 'test-sid',
        token: 'test-token',
        page: 'pages/session/join/index',
        envVersion: 'trial'
      }, mockContext);
      
      expect(result.ok).toBe(true);
      
      // 验证环境版本参数
      expect(mockCloud.openapi.wxacode.getUnlimited).toHaveBeenCalledWith(
        expect.objectContaining({
          env_version: 'trial'
        })
      );
    });
  });
});

