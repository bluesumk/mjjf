/**
 * 功能开关配置
 * 用于控制各种功能的开启/关闭状态
 */

// 功能开关接口
export interface FeatureFlag {
  name: string;           // 功能名称
  description: string;    // 功能描述
  enabled: boolean;       // 是否启用
  defaultValue: boolean;  // 默认值
  category: string;       // 功能分类
  version?: string;       // 版本信息
  deprecated?: boolean;   // 是否已废弃
}

// 功能开关配置
export const FEATURE_FLAGS: Record<string, FeatureFlag> = {
  // 小程序码相关功能
  'useWxacode': {
    name: 'useWxacode',
    description: '启用微信小程序码生成功能',
    enabled: true,
    defaultValue: true,
    category: 'wxacode'
  },
  
  'wxacodeRetry': {
    name: 'wxacodeRetry',
    description: '小程序码生成重试次数',
    enabled: true,
    defaultValue: true,
    category: 'wxacode'
  },
  
  'wxacodeCache': {
    name: 'wxacodeCache',
    description: '启用小程序码缓存功能',
    enabled: true,
    defaultValue: true,
    category: 'wxacode'
  },
  
  'wxacodeFallback': {
    name: 'wxacodeFallback',
    description: '启用小程序码降级到文本功能',
    enabled: true,
    defaultValue: true,
    category: 'wxacode'
  },

  // 计分相关功能
  'autoStartScoring': {
    name: 'autoStartScoring',
    description: '自动开始计分功能',
    enabled: false,
    defaultValue: false,
    category: 'scoring'
  },
  
  'qrInvite': {
    name: 'qrInvite',
    description: '二维码邀请功能',
    enabled: true,
    defaultValue: true,
    category: 'invite'
  },

  // 会话管理功能
  'sessionPersistence': {
    name: 'sessionPersistence',
    description: '会话持久化功能',
    enabled: true,
    defaultValue: true,
    category: 'session'
  },
  
  'multiSession': {
    name: 'multiSession',
    description: '多会话支持',
    enabled: false,
    defaultValue: false,
    category: 'session'
  },

  // 用户功能
  'userProfile': {
    name: 'userProfile',
    description: '用户资料功能',
    enabled: true,
    defaultValue: true,
    category: 'user'
  },
  
  'userHistory': {
    name: 'userHistory',
    description: '用户历史记录',
    enabled: true,
    defaultValue: true,
    category: 'user'
  },

  // 统计功能
  'analytics': {
    name: 'analytics',
    description: '数据统计功能',
    enabled: true,
    defaultValue: true,
    category: 'analytics'
  },
  
  'performance': {
    name: 'performance',
    description: '性能监控功能',
    enabled: false,
    defaultValue: false,
    category: 'analytics'
  },

  // 开发调试功能
  'debugMode': {
    name: 'debugMode',
    description: '调试模式',
    enabled: false,
    defaultValue: false,
    category: 'development'
  },
  
  'mockData': {
    name: 'mockData',
    description: '模拟数据功能',
    enabled: false,
    defaultValue: false,
    category: 'development'
  }
};

// 功能开关管理器
export class FeatureFlagManager {
  private flags: Record<string, FeatureFlag>;
  private storageKey = 'feature_flags';

  constructor() {
    this.flags = { ...FEATURE_FLAGS };
    this.loadFromStorage();
  }

  /**
   * 检查功能是否启用
   */
  isEnabled(flagName: string): boolean {
    const flag = this.flags[flagName];
    if (!flag) {
      console.warn(`未知的功能开关: ${flagName}`);
      return false;
    }
    return flag.enabled;
  }

  /**
   * 启用功能
   */
  enable(flagName: string): boolean {
    const flag = this.flags[flagName];
    if (!flag) {
      console.error(`未知的功能开关: ${flagName}`);
      return false;
    }
    
    flag.enabled = true;
    this.saveToStorage();
    console.log(`功能已启用: ${flagName}`);
    return true;
  }

  /**
   * 禁用功能
   */
  disable(flagName: string): boolean {
    const flag = this.flags[flagName];
    if (!flag) {
      console.error(`未知的功能开关: ${flagName}`);
      return false;
    }
    
    flag.enabled = false;
    this.saveToStorage();
    console.log(`功能已禁用: ${flagName}`);
    return true;
  }

  /**
   * 重置功能到默认值
   */
  reset(flagName: string): boolean {
    const flag = this.flags[flagName];
    if (!flag) {
      console.error(`未知的功能开关: ${flagName}`);
      return false;
    }
    
    flag.enabled = flag.defaultValue;
    this.saveToStorage();
    console.log(`功能已重置: ${flagName} -> ${flag.defaultValue}`);
    return true;
  }

  /**
   * 重置所有功能到默认值
   */
  resetAll(): void {
    Object.values(this.flags).forEach(flag => {
      flag.enabled = flag.defaultValue;
    });
    this.saveToStorage();
    console.log('所有功能已重置到默认值');
  }

  /**
   * 获取功能信息
   */
  getFlag(flagName: string): FeatureFlag | null {
    return this.flags[flagName] || null;
  }

  /**
   * 获取所有功能
   */
  getAllFlags(): Record<string, FeatureFlag> {
    return { ...this.flags };
  }

  /**
   * 获取指定分类的功能
   */
  getFlagsByCategory(category: string): Record<string, FeatureFlag> {
    const result: Record<string, FeatureFlag> = {};
    Object.entries(this.flags).forEach(([name, flag]) => {
      if (flag.category === category) {
        result[name] = flag;
      }
    });
    return result;
  }

  /**
   * 批量更新功能状态
   */
  updateFlags(updates: Record<string, boolean>): void {
    Object.entries(updates).forEach(([flagName, enabled]) => {
      if (this.flags[flagName]) {
        this.flags[flagName].enabled = enabled;
      }
    });
    this.saveToStorage();
    console.log('功能状态已批量更新');
  }

  /**
   * 从存储加载配置
   */
  private loadFromStorage(): void {
    try {
      const stored = wx.getStorageSync(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.entries(parsed).forEach(([name, enabled]) => {
          if (this.flags[name]) {
            this.flags[name].enabled = enabled as boolean;
          }
        });
        console.log('功能开关配置已从存储加载');
      }
    } catch (error) {
      console.error('加载功能开关配置失败:', error);
    }
  }

  /**
   * 保存配置到存储
   */
  private saveToStorage(): void {
    try {
      const config: Record<string, boolean> = {};
      Object.entries(this.flags).forEach(([name, flag]) => {
        config[name] = flag.enabled;
      });
      
      wx.setStorageSync(this.storageKey, JSON.stringify(config));
    } catch (error) {
      console.error('保存功能开关配置失败:', error);
    }
  }

  /**
   * 导出配置
   */
  exportConfig(): string {
    return JSON.stringify(this.flags, null, 2);
  }

  /**
   * 导入配置
   */
  importConfig(configJson: string): boolean {
    try {
      const config = JSON.parse(configJson);
      Object.entries(config).forEach(([name, flagData]) => {
        if (this.flags[name]) {
          this.flags[name] = { ...this.flags[name], ...flagData };
        }
      });
      this.saveToStorage();
      console.log('功能开关配置已导入');
      return true;
    } catch (error) {
      console.error('导入功能开关配置失败:', error);
      return false;
    }
  }
}

// 导出默认实例
export const featureFlags = new FeatureFlagManager();

// 导出便捷方法
export const {
  isEnabled,
  enable,
  disable,
  reset,
  resetAll,
  getFlag,
  getAllFlags,
  getFlagsByCategory,
  updateFlags
} = featureFlags;

// 导出常用功能检查函数
export const isWxacodeEnabled = () => featureFlags.isEnabled('useWxacode');
export const isWxacodeRetryEnabled = () => featureFlags.isEnabled('wxacodeRetry');
export const isWxacodeCacheEnabled = () => featureFlags.isEnabled('wxacodeCache');
export const isWxacodeFallbackEnabled = () => featureFlags.isEnabled('wxacodeFallback');
export const isAutoStartScoringEnabled = () => featureFlags.isEnabled('autoStartScoring');
export const isQrInviteEnabled = () => featureFlags.isEnabled('qrInvite');
export const isDebugModeEnabled = () => featureFlags.isEnabled('debugMode');

