import fs from "fs";
import path from "path";
import { CONFIG } from "./config";
import { isWhiteBackground } from "./is-white-bg";

fs.mkdirSync(CONFIG.WHITE_BG_DIR, { recursive: true });
fs.mkdirSync(CONFIG.OTHERS_DIR, { recursive: true });

/**
 * Recursively get all image files from a directory
 */
function getAllImages(dir: string): string[] {
  let results: string[] = [];

  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      results = results.concat(getAllImages(fullPath));
    } else if (item.isFile() && /\.(jpg|jpeg|png|webp|gif)$/i.test(item.name)) {
      results.push(fullPath);
    }
  }

  return results;
}

async function divideImages() {
  console.log(`🔍 Scanning all images from: ${CONFIG.ALL_IMAGES_DIR}`);
  console.log("—".repeat(50));

  const images = getAllImages(CONFIG.ALL_IMAGES_DIR);

  let whiteBgCount = 0;
  let othersCount = 0;

  console.log(`📸 Total images found: ${images.length}`);
  console.log("—".repeat(50));

  for (const imagePath of images) {
    const fileName = path.basename(imagePath);

    const { result, ratio } = await isWhiteBackground(imagePath);

    const targetDir = result
      ? CONFIG.WHITE_BG_DIR
      : CONFIG.OTHERS_DIR;

    if (result) whiteBgCount++;
    else othersCount++;

    fs.copyFileSync(
      imagePath,
      path.join(targetDir, fileName)
    );

    if (CONFIG.DEBUG) {
      console.log(
        `${result ? "✅ WHITE BG" : "❌ OTHERS"} | ` +
        `White ratio: ${(ratio * 100).toFixed(1)}% | ${fileName}`
      );
    }
  }

  console.log("—".repeat(50));
  console.log("📊 Summary:");
  console.log(`✅ WHITE BG: ${whiteBgCount}`);
  console.log(`❌ OTHERS:   ${othersCount}`);
  console.log(`📦 Total:    ${whiteBgCount + othersCount}`);
  console.log("—".repeat(50));
  console.log("✅ Image division complete");
}

divideImages();
