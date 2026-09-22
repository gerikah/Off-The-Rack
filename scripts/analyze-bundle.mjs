import { readdir, readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
const root = ".next/static";
async function files(dir) {
  return (
    await Promise.all(
      (await readdir(dir, { withFileTypes: true })).map((e) =>
        e.isDirectory() ? files(dir + "/" + e.name) : dir + "/" + e.name,
      ),
    )
  ).flat();
}
const list = await files(root);
const chunks = [];
for (const path of list.filter((p) => p.endsWith(".js"))) {
  const data = await readFile(path);
  chunks.push({ path, bytes: data.length, gzip: gzipSync(data).length });
}
chunks.sort((a, b) => b.bytes - a.bytes);
console.log(
  JSON.stringify(
    {
      scope:
        "All emitted production browser chunks; not a single route download or Web Vitals score",
      totalBytes: chunks.reduce((n, c) => n + c.bytes, 0),
      totalGzip: chunks.reduce((n, c) => n + c.gzip, 0),
      chunkCount: chunks.length,
      largest: chunks.slice(0, 8),
      publicSourceMaps: list.filter((p) => p.endsWith(".map")),
      cssBytes: (
        await Promise.all(
          list
            .filter((p) => p.endsWith(".css"))
            .map(async (p) => (await stat(p)).size),
        )
      ).reduce((a, b) => a + b, 0),
    },
    null,
    2,
  ),
);
