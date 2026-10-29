export async function fetchJSON(url, options = {}, fetcher = fetch, milliseconds = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), milliseconds);
  try {
    const response = await fetcher(url, { ...options, signal: controller.signal, redirect: "error" });
    if (!response.ok) throw new Error(`服务返回 ${response.status}，请检查权限、网络或账户额度`);
    const length = Number(response.headers.get("content-length"));
    if (length > 2000000) throw new Error("服务响应过大");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("服务响应为空");
    const chunks = []; let size = 0;
    while (true) {
      const row = await reader.read();
      if (row.done) break;
      size += row.value.length;
      if (size > 2000000) { await reader.cancel(); throw new Error("服务响应过大"); }
      chunks.push(row.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    if (controller.signal.aborted) throw new Error("连接超时，请稍后重试");
    throw error;
  } finally { clearTimeout(timer); }
}
