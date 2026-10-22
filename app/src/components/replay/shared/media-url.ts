export const image = (url: string) =>
  `/api/proxy-image?url=${encodeURIComponent(url)}`;

export const asset = (id: string, file: string) =>
  `/api/replay/media/${encodeURIComponent(id)}/${encodeURIComponent(file)}`;
