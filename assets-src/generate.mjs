// One-off asset generation script: renders the source SVGs into the PNG
// files @capacitor/assets generate (run separately, see README) needs as
// its input. Run with:
//   node assets-src/generate.mjs
//   npx @capacitor/assets generate --splashBackgroundColor '#FBF6EA' --splashBackgroundColorDark '#2B2020'
//
// The second command regenerates android/, ios/, AND www/assets/icons/ (the
// PWA manifest icons, referenced by www/manifest.json) — don't hand-maintain
// a separate icons/ folder, @capacitor/assets owns that output.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const iconSvg = path.join(root, "assets-src/icon.svg");
const splashSvg = path.join(root, "assets-src/splash.svg");

async function main() {
  await mkdir(path.join(root, "assets"), { recursive: true });

  await sharp(iconSvg).resize(1024, 1024).png().toFile(path.join(root, "assets/icon.png"));
  await sharp(iconSvg).resize(512, 512).png().toFile(path.join(root, "assets/icon-512.png"));
  await sharp(splashSvg).resize(2732, 2732).png().toFile(path.join(root, "assets/splash.png"));
  await sharp(splashSvg).resize(2732, 2732).png().toFile(path.join(root, "assets/splash-dark.png"));

  console.log("Source assets generated. Now run: npx @capacitor/assets generate ...");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
