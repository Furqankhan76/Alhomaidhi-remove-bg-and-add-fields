import fs from "fs";
import path from "path";
import { CONFIG } from "./config";
import { isWhiteBackground } from "./is-white-bg";

fs.mkdirSync(CONFIG.WHITE_BG_DIR, { recursive: true });
fs.mkdirSync(CONFIG.OTHERS_DIR, { recursive: true });

async function divideImages() {
  const files = fs.readdirSync(CONFIG.INPUT_DIR);

  let whiteBgCount = 0;
  let othersCount = 0;

  console.log(`🔍 Found ${files.length} files`);
  console.log("—".repeat(50));

  for (const file of files) {
    if (!file.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
      if (CONFIG.DEBUG) {
        console.log(`⏭ Skipped non-image: ${file}`);
      }
      continue;
    }

    const inputPath = path.join(CONFIG.INPUT_DIR, file);
    const { result, ratio } = await isWhiteBackground(inputPath);

    const targetDir = result
      ? CONFIG.WHITE_BG_DIR
      : CONFIG.OTHERS_DIR;

    if (result) {
      whiteBgCount++;
    } else {
      othersCount++;
    }

    fs.copyFileSync(
      inputPath,
      path.join(targetDir, file)
    );

    if (CONFIG.DEBUG) {
      console.log(
        `${result ? "✅ WHITE BG" : "❌ OTHERS"} | ` +
        `White ratio: ${(ratio * 100).toFixed(1)}% | ${file}`
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
