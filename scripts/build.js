const fs = require("fs");
const path = require("path");
const { minify: minifyHtml } = require("html-minifier-terser");
const CleanCSS = require("clean-css");
const terser = require("terser");

async function build() {
  const root = process.cwd();
  const htmlPath = path.join(root, "index.html");
  const cssPath = path.join(root, "countdown.css");
  const jsPath = path.join(root, "countdown.js");
  const outputPath = path.join(root, "index.min.html");

  if (!fs.existsSync(htmlPath) || !fs.existsSync(cssPath) || !fs.existsSync(jsPath)) {
    throw new Error("Missing required files: index.html, countdown.css, or countdown.js");
  }

  const htmlRaw = fs.readFileSync(htmlPath, "utf8");
  const cssRaw = fs.readFileSync(cssPath, "utf8");
  const jsRaw = fs.readFileSync(jsPath, "utf8");

  const cssMin = new CleanCSS({ level: 2 }).minify(cssRaw);
  if (cssMin.errors.length) {
    throw new Error(`CSS minify error: ${cssMin.errors.join("; ")}`);
  }

  const jsMin = await terser.minify(jsRaw, {
    compress: true,
    mangle: true,
    format: { comments: false }
  });

  if (jsMin.error) {
    throw jsMin.error;
  }

  const inlined = htmlRaw
    .replace(/<link\s+rel="stylesheet"\s+href="countdown\.css"\s*\/?\s*>/i, `<style>${cssMin.styles}</style>`)
    .replace(/<script\s+src="countdown\.js"\s*><\/script>/i, `<script>${jsMin.code}</script>`);

  const htmlMin = await minifyHtml(inlined, {
    collapseWhitespace: true,
    removeComments: true,
    minifyCSS: false,
    minifyJS: false,
    removeRedundantAttributes: true,
    removeEmptyAttributes: true,
    useShortDoctype: true,
    keepClosingSlash: true,
    sortAttributes: true,
    sortClassName: true
  });

  fs.writeFileSync(outputPath, htmlMin, "utf8");
  console.log(`Built: ${path.basename(outputPath)}`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
