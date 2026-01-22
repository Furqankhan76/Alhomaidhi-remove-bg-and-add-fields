import sharp from "sharp";
import { CONFIG } from "./config";

export async function isWhiteBackground(
  imagePath: string
): Promise<{ result: boolean; ratio: number }> {
  const { data, info } = await sharp(imagePath)
    .resize(300)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { channels } = info;
  let whitePixels = 0;
  const totalPixels = data.length / channels;

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r > 240 && g > 240 && b > 240) {
      whitePixels++;
    }
  }

  const ratio = whitePixels / totalPixels;
  return { result: ratio >= CONFIG.REQUIRED_WHITE_PERCENTAGE, ratio };
}
