// 網頁版推播的 service worker。只處理推播：不做離線快取，不攔任何 fetch。
// 伺服器送來的內容見 src/lib/webPush.ts 的 WebPushPayload。

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // 不是 JSON 就用預設文字
  }

  const tasks = [
    self.registration.showNotification(data.title || "Googoocard", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,
      data: { url: data.url || "/" },
    }),
  ];
  // 主畫面圖示上的數字（有支援 Badging API 的才有）
  if (typeof data.badge === "number" && "setAppBadge" in self.navigator) {
    tasks.push(self.navigator.setAppBadge(data.badge).catch(() => {}));
  }
  event.waitUntil(Promise.all(tasks));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin);
  // 只開自己網站的網址
  const target = url.origin === self.location.origin ? url.href : self.location.origin;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // 已經開著網站就沿用那個分頁
      const existing = windows.find((w) => w.url.startsWith(self.location.origin));
      if (existing) return existing.focus().then((w) => (w || existing).navigate(target));
      return self.clients.openWindow(target);
    })
  );
});
