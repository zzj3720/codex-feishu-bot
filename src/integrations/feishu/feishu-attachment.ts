import { basename, extname } from "node:path";

const FILE_TYPE_BY_EXTENSION: Record<string, "opus" | "mp4" | "pdf" | "doc" | "xls" | "ppt" | "stream"> = {
  ".mp4": "mp4",
  ".mov": "mp4",
  ".m4v": "mp4",
  ".pdf": "pdf",
  ".doc": "doc",
  ".docx": "doc",
  ".txt": "doc",
  ".md": "doc",
  ".xls": "xls",
  ".xlsx": "xls",
  ".csv": "xls",
  ".ppt": "ppt",
  ".pptx": "ppt",
  ".opus": "opus",
  ".mp3": "stream",
  ".wav": "stream",
  ".json": "stream"
};

export function resolveFeishuFileType(path: string): "opus" | "mp4" | "pdf" | "doc" | "xls" | "ppt" | "stream" {
  return FILE_TYPE_BY_EXTENSION[extname(path).toLowerCase()] ?? "stream";
}

export function resolveFeishuFileName(path: string, explicitName?: string): string {
  return explicitName ?? basename(path);
}
