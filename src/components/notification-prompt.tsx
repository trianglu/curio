"use client";

import { useCallback, useEffect, useState } from "react";
import { useLearning } from "@/context/learning-context";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length) as Uint8Array<ArrayBuffer>;
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function NotificationPrompt() {
  const { profile, savePushSubscription } = useLearning();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      alert("Push notifications aren't supported in this browser.");
      return;
    }

    const permissionResult = await Notification.requestPermission();
    setPermission(permissionResult);
    if (permissionResult !== "granted") return;

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      new Notification("Curio", {
        body: "Notifications enabled! (Local only — add VAPID keys for push while app is closed)",
        icon: "/icon",
      });
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const subJson = subscription.toJSON();
    if (subJson.endpoint && subJson.keys?.p256dh && subJson.keys?.auth) {
      await savePushSubscription({
        endpoint: subJson.endpoint,
        keys: { p256dh: subJson.keys.p256dh, auth: subJson.keys.auth },
      });
    }
  }, [savePushSubscription]);

  if (dismissed || permission === "granted" || profile.pushSubscription) return null;
  if (!profile.paths.some((p) => p.mode === "passive")) return null;

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
      <div className="flex items-start gap-3">
        <span className="text-xl">🔔</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-violet-900">
            Get notified when your next lesson is ready
          </p>
          <p className="mt-1 text-xs text-violet-700">
            Perfect for passive mode — we&apos;ll ping you when new bite-sized lessons arrive.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={subscribe}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
            >
              Enable notifications
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-lg px-3 py-1.5 text-xs text-violet-600 hover:bg-violet-100"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export async function sendLocalNotification(title: string, body: string, url?: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      body,
      icon: "/icon",
      data: { url: url ?? "/" },
    });
    return;
  }

  new Notification(title, { body, icon: "/icon" });
}

export async function sendPushNotification(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  title: string,
  body: string,
  url?: string,
) {
  await fetch("/api/push", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription, title, body, url }),
  });
}
