import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";
import os from "node:os";
import type { FastifyPluginAsync } from "fastify";

export const mediaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/api/local-media", async (request, reply) => {
    const mediaPath = String(
      (request.query as { path?: string } | undefined)?.path ?? "",
    ).trim();

    if (!mediaPath) {
      return reply.code(400).send({
        error: "media_path_required",
        message: "path is required",
      });
    }

    if (!isAbsolute(mediaPath)) {
      return reply.code(400).send({
        error: "media_path_invalid",
        message: "path must be absolute",
      });
    }
    const resolvedPath = resolve(mediaPath);
    const previewCacheDirectory = resolve(
      os.tmpdir(),
      "vaexcore-pulse-preview-clips",
    );
    const relativePath = relative(previewCacheDirectory, resolvedPath);
    if (
      relativePath.startsWith("..") ||
      relativePath.includes("\0") ||
      relativePath === ""
    ) {
      return reply.code(403).send({
        error: "media_path_forbidden",
        message:
          "vaexcore pulse only serves its own generated preview clips through this route.",
      });
    }

    let fileStats;
    try {
      fileStats = await stat(resolvedPath);
    } catch {
      return reply.code(404).send({
        error: "media_not_found",
        message: "The requested local media file was not found.",
      });
    }

    if (!fileStats.isFile()) {
      return reply.code(400).send({
        error: "media_not_file",
        message: "The requested local media path is not a file.",
      });
    }

    const totalSize = fileStats.size;
    const rangeHeader = request.headers.range;
    const contentType = detectMediaContentType(resolvedPath);

    reply.header("accept-ranges", "bytes");
    reply.header("cache-control", "no-store");
    reply.header("content-type", contentType);

    if (!rangeHeader) {
      reply.header("content-length", String(totalSize));
      return reply.code(200).send(createReadStream(resolvedPath));
    }

    const byteRange = parseByteRange(rangeHeader, totalSize);
    if (!byteRange) {
      reply.header("content-range", `bytes */${totalSize}`);
      return reply.code(416).send({
        error: "range_not_satisfiable",
        message: "The requested media byte range could not be served.",
      });
    }

    const { start, end } = byteRange;
    reply
      .code(206)
      .header("content-length", String(end - start + 1))
      .header("content-range", `bytes ${start}-${end}/${totalSize}`);

    return reply.send(createReadStream(resolvedPath, { start, end }));
  });
};

function parseByteRange(
  rangeHeader: string,
  totalSize: number,
): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) {
    return null;
  }

  const rawStart = match[1];
  const rawEnd = match[2];

  if (!rawStart && !rawEnd) {
    return null;
  }

  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }

    const start = Math.max(0, totalSize - suffixLength);
    return { start, end: totalSize - 1 };
  }

  const start = Number(rawStart);
  if (!Number.isFinite(start) || start < 0 || start >= totalSize) {
    return null;
  }

  const end = rawEnd ? Number(rawEnd) : totalSize - 1;
  if (!Number.isFinite(end) || end < start) {
    return null;
  }

  return {
    start,
    end: Math.min(end, totalSize - 1),
  };
}

function detectMediaContentType(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case ".mp4":
    case ".m4v":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    case ".webm":
      return "video/webm";
    case ".mp3":
      return "audio/mpeg";
    case ".m4a":
      return "audio/mp4";
    case ".wav":
      return "audio/wav";
    default:
      return "application/octet-stream";
  }
}
