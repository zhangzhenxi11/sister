# HarmonyOS NEXT 壳工程（Starter）

Capacitor 不支持 HarmonyOS NEXT，本目录提供等价的 **ArkTS WebView 壳**起步方案：
壳内加载与 iOS/Android 完全相同的 H5 资源包，业务迭代只需更新 H5。

## 1. 创建工程（DevEco Studio 5.0+）

1. File → New → Create Project → **Empty Ability**（API 12 / compileSdk 12+，Stage 模型）；
2. 应用包名建议与 Capacitor 保持一致：`com.sisterprj.emocompanion`；
3. 工程名：`EmoCompanion`。

## 2. 网络权限

`entry/src/main/module.json5` 的 `module.requestPermissions` 增加：

```json5
{ "name": "ohos.permission.INTERNET" }
```

## 3. 主页面（WebView）

`entry/src/main/ets/pages/Index.ets`：

```ts
import web_webview from '@ohos.web.webview';

const H5_URL = 'https://your-domain.com'; // 生产：H5 CDN 地址（热更新只改这里）

@Entry
@Component
struct Index {
  private controller: web_webview.WebviewController = new web_webview.WebviewController();
  @State progress: number = 100;

  build() {
    Column() {
      Web({ src: H5_URL, controller: this.controller })
        .width('100%')
        .layoutWeight(1)
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .onlineImageAccess(true)
        .fileAccess(true)
        .mediaPlayGestureAccess(true)
        .progress((e) => { this.progress = e.newProgress })
      if (this.progress < 100) {
        Progress({ value: this.progress, total: 100, type: ProgressType.Linear })
          .width('100%')
          .height(2)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(Color.White)
    .padding({ bottom: this.getSafeAreaBottom() })
  }

  private getSafeAreaBottom(): number {
    // 底部安全区：也可用 window 的 avoidArea API 精确获取
    return 0;
  }
}
```

## 4. 返回键处理（可选）

在 `EntryAbility.ets` 的 `onWindowStageCreate` 中不处理即为默认 WebView 内历史回退；
如需"双击退出"，监听 `onBackPressed` 并判断 `controller.accessBackward()`。

## 5. 上架注意

- **App 备案 + 软著**先行（见根目录 README 路线图）；
- 华为审核要求声明 WebView 加载的第三方 URL（在 AGC「版本信息 → 隐私/权限」中填写 H5 域名）；
- H5 热更新仅限 Web 资源；不要动态下发 ArkTS/字节码（违反华为热更新规范）；
- 相册/相机如需原生能力，HarmonyOS 侧用 `@ohos.mediaLibrary` /  picker 选图后经 `javaScriptProxy` 注入 H5 调用，与 Capacitor 插件同构。
