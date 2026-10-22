export function isFrameFile(file: string): boolean {
  return /^frame-(?:\d{2}|v[23]-\d{1,3}-\d{2})\.jpg$/.test(file);
}
