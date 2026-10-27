/**
 * 클라이언트 측 이미지 압축 및 리사이징 유틸리티
 */

export const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const resizeAndCompressImage = (
  dataUrl: string,
  maxDimension = 1024,
  quality = 0.75
): Promise<string> => {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return resolve(dataUrl);
    }

    // jsdom 또는 캔버스 비지원 환경 가드 (테스트 환경에서 무한 대기 방지)
    try {
      const testCanvas = document.createElement("canvas");
      const testCtx = testCanvas.getContext?.("2d");
      if (!testCtx) {
        return resolve(dataUrl);
      }
    } catch {
      return resolve(dataUrl);
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let { width, height } = img;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return resolve(dataUrl);
      }

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const compressed = canvas.toDataURL("image/jpeg", quality);
      resolve(compressed);
    };

    img.onerror = () => {
      resolve(dataUrl);
    };

    img.src = dataUrl;
  });
};
