import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import matter from "gray-matter";
import siteConfig from "../src/site.config.ts";

const root = process.cwd();
const password = process.env.ENCRYPT_PASSWORD ?? siteConfig.pages?.interviewCenter?.unlock?.password ?? "";

if (!siteConfig.encrypt.enable) {
  console.log("[encrypt] disabled in site.config.ts, skip.");
  process.exit(0);
}

if (!password) {
  console.error("[encrypt] missing ENCRYPT_PASSWORD environment variable.");
  process.exit(1);
}

async function walk(dir) {
  const items = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const item of items) {
    const absolute = path.join(dir, item.name);
    if (item.isDirectory()) files.push(...(await walk(absolute)));
    if (item.isFile() && (absolute.endsWith(".md") || absolute.endsWith(".mdx"))) files.push(absolute);
  }
  return files;
}

async function removeInterviewPayloads(dir) {
  let items = [];
  try {
    items = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  await Promise.all(
    items
      .filter((item) => item.isFile() && /^interview-.*\.json$/i.test(item.name))
      .map((item) => fs.unlink(path.join(dir, item.name)))
  );
}

function encryptText(plainText) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    salt: salt.toString("base64"),
    ciphertext: Buffer.concat([encrypted, tag]).toString("base64")
  };
}

async function buildEncryptedPayload() {
  const targets = [
    { collection: "blog", base: path.join(root, "src", "content", "blog") },
    { collection: "tutorial", base: path.join(root, "src", "content", "tutorial") }
  ];
  const outputDir = path.join(root, siteConfig.encrypt.outputDir);
  const manifest = {};

  await fs.mkdir(outputDir, { recursive: true });
  await removeInterviewPayloads(outputDir);

  for (const target of targets) {
    const files = await walk(target.base);
    for (const file of files) {
      const raw = await fs.readFile(file, "utf8");
      const parsed = matter(raw);
      if (!parsed.data.encrypted) continue;

      const relative = path.relative(target.base, file).replace(/\\/g, "/").replace(/\.(md|mdx)$/i, "");
      const outputName = `${target.collection}-${relative.replace(/\//g, "-")}.json`;
      const payload = encryptText(parsed.content);
      payload.version = 1;

      const outputPath = path.join(outputDir, outputName);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, JSON.stringify(payload), "utf8");

      const publicPath = `/${siteConfig.encrypt.outputDir.replace(/^public\/?/, "")}/${outputName}`.replace(/\/{2,}/g, "/");
      manifest[`${target.collection}:${relative}`] = publicPath;
    }
  }

  const manifestPath = path.join(root, siteConfig.encrypt.manifestFile);
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString(), manifest }), "utf8");

  console.log(`[encrypt] generated ${Object.keys(manifest).length} encrypted payload(s).`);
}

buildEncryptedPayload().catch((error) => {
  console.error("[encrypt] failed:", error);
  process.exit(1);
});
