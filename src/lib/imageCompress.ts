/**
 * 图片压缩工具 —— 移动端上传前置处理
 *
 * 核心场景：聊天截图上传。截图为 PNG，动辄 2-5MB；
 * 压缩到最长边 1600px + JPEG 0.8 后通常 < 500KB，移动端流量与内存双收益。
 */

export interface CompressOptions {
  /** 最长边像素（默认 1600，兼顾长截图文字清晰度） */
  maxDim?: number;
  /** JPEG 质量 0-1（默认 0.8） */
  quality?: number;
  /** 输出 MIME（默认 image/jpeg；含透明需求时用 image/webp） */
  type?: string;
}

export async function compressImage(
  file: Blob,
  options: CompressOptions = {},
): Promise<Blob> {
  const { maxDim = 1600, quality = 0.8, type = 'image/jpeg' } = options;

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('当前环境不支持 canvas');
    }
    ctx.drawImage(img, 0, 0, w, h);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('图片压缩失败'))),
        type,
        quality,
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = url;
  });
}

/** Blob → base64（走 JSON 兼容端点时使用；推荐优先用 multipart 上传） */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      // 去掉 data:image/...;base64, 前缀
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(blob);
  });
}

/** 选择文件 → 压缩 → multipart 上传 /api/analyze/upload 的完整便捷封装 */
export async function uploadScreenshot(
  file: File,
  onProgress?: (percent: number) => void,
  token?: string | null,
): Promise<Response> {
  const compressed = await compressImage(file);

  const formData = new FormData();
  formData.append('file', compressed, file.name.replace(/\.\w+$/, '') + '.jpg');

  // 原生 fetch 不支持上传进度；XHR 包装以便展示进度条
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/analyze/upload');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    if (onProgress) {
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }
    xhr.onload = () => {
      try {
        resolve(new Response(xhr.responseText, { status: xhr.status }));
      } catch (error) {
        reject(error);
      }
    };
    xhr.onerror = () => reject(new Error('网络错误'));
    xhr.send(formData);
  });
}
