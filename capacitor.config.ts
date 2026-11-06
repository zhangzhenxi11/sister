import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sisterprj.emocompanion',
  appName: '情感AI伴侣',
  webDir: 'dist',
  server: {
    // WebView 内以 https scheme 加载本地资源（部分 Web API 要求安全上下文）
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
