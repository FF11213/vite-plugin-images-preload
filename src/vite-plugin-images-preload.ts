import { type Plugin } from "vite"
import fg from "fast-glob"

interface PreloadImagesOptions {
  dir: string
  concurrent?: number // 添加并发控制选项
}

const preloadImages = (options: PreloadImagesOptions): Plugin => {
  const { dir = "src/assets/images/dataSource/*.{png,jpg,jpeg,gif,svg}", concurrent = 1 } = options
  const preloadImages: string[] = []

  // 构建注入的脚本内容
  const getInjectScript = (images: string[]) => {
    return `
      (function(){
        function loadImage(src) {
          return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = src;
            link.onload = resolve;
            link.onerror = reject;
            document.head.appendChild(link);
            setTimeout(() => reject(new Error('Timeout')), 10000);
          });
        }

        function loadImagesConcurrent(images, concurrent = ${concurrent}) {
          const total = images.length;
          let current = 0;

          function load() {
            if (current >= total) return;
            
            const src = images[current++];
            loadImage(src)
              .catch(err => console.error('Failed to preload:', src, err))
              .finally(() => load());
          }

          // 启动并发加载
          for (let i = 0; i < concurrent; i++) {
            load();
          }
        }

        loadImagesConcurrent(${JSON.stringify(images)});
      })();
    `
  }

  return {
    name: "vite-plugin-preload-images",
    generateBundle(_, bundle) {
      const values = Object.values(bundle)
      const files = fg.sync(dir)

      values.forEach((item) => {
        files.includes(Reflect.get(item, "originalFileName")) && preloadImages.push(item.fileName)
      })
    },
    transformIndexHtml(html, ctx) {
      let images: string[]
      if (ctx.server) {
        const files = fg.sync(dir)
        console.log(files)
        images = files.map((file) => (ctx.server?.config.base ?? "") + file)
      } else {
        images = preloadImages
      }

      // return images.map((image) => {
      //   return {
      //     tag: 'link',
      //     attrs: {
      //       rel: 'preload',
      //       href: image,
      //       as: 'image',
      //       ...attrs
      //     }
      //   }
      // })
      return [
        {
          tag: "script",
          children: getInjectScript(images),
          injectTo: "head",
        },
      ]
    },
  }
}

export default preloadImages
