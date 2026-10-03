import { api } from "../services/index.js";
export function watchStore(render) {
  let queued = false;
  return api.subscribe(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      render();
    });
  });
}
