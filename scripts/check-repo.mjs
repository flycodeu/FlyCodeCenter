import { execFileSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const generatedDirs = new Set([
  '.git', '.astro', '.vercel', '.idea', 'node_modules', '.venv', 'venv',
  '__pycache__', 'target', 'dist', '.cache', 'coverage',
  'test-results', 'playwright-report', 'playwright-report-performance'
]);

// Filename checks, not a secret scanner. Example environment templates are allowed.
export function pathIssue(filename, { directory = false, published = false } = {}) {
  const parts = filename.replaceAll('\\', '/').split('/');
  const basename = parts.at(-1);
  const directories = directory ? parts : parts.slice(0, -1);
  if (directories.some(part => generatedDirs.has(part) || part.startsWith('.tmp-build'))) {
    return '生成目录或本地工具目录';
  }
  if (directory) return null;
  if (/^\.env(?:\..+)?$/.test(basename) && !/^\.env(?:\..+)?\.example$/.test(basename)) {
    return '本地环境变量文件';
  }
  if (/\.(?:pyc|pyo|class|jar|tsbuildinfo|log)$/i.test(basename) || ['.DS_Store', 'Thumbs.db', 'Desktop.ini'].includes(basename)) {
    return '编译产物、日志或系统文件';
  }
  if ((published || parts[0] === 'public') && /\.(?:onnx|pth|pt|safetensors)$/i.test(basename)) {
    return '模型权重不应随网站发布';
  }
  return null;
}

// Astro copies public even when Git ignores its contents. Inspect the real directory.
export async function inspectPublic(root) {
  const issues = [];
  async function visit(relative) {
    let entries;
    try {
      entries = await readdir(path.join(root, relative), { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT' && relative === 'public') return;
      throw error;
    }
    for (const entry of entries) {
      const filename = `${relative}/${entry.name}`;
      const reason = entry.isSymbolicLink() ? '公开目录不允许符号链接' : pathIssue(filename, {
        directory: entry.isDirectory(), published: true
      });
      if (reason) issues.push(`${filename}: ${reason}`);
      else if (entry.isDirectory()) await visit(filename);
    }
  }
  await visit('public');
  return issues;
}

export async function checkRepository(root) {
  const filenames = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: root, encoding: 'utf8'
  }).split('\0').filter(Boolean);
  const issues = new Set();
  for (const filename of filenames) {
    const reason = pathIssue(filename);
    if (reason) issues.add(`${filename}: ${reason}`);
  }
  for (const issue of await inspectPublic(root)) issues.add(issue);
  return [...issues].sort();
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const issues = await checkRepository(root);
  if (issues.length) {
    console.error(`仓库检查失败：\n${issues.map(issue => `- ${issue}`).join('\n')}\n请移走生成文件，不要仅添加到 .gitignore。`);
    process.exitCode = 1;
  } else {
    console.log('仓库检查通过：Git 文件列表及 public 发布目录未发现受限产物。');
  }
}
