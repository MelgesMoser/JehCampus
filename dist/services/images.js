// Storage port: replace with Firebase Storage upload when a backend is introduced.
export async function uploadImage(file) {
  if (!file) return null;
  if (
    !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)
  )
    throw Error("Use uma imagem JPG, PNG, WebP ou GIF.");
  if (file.size > 10 * 1024 * 1024) throw Error("A foto deve ter até 10 MB.");
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/webp", 0.82);
}
