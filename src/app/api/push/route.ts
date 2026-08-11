import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:curio@localhost";

  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      subscription?: {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      userId?: string;
    };

    if (!body.subscription) {
      return NextResponse.json({ error: "Subscription required" }, { status: 400 });
    }

    if (isSupabaseConfigured() && body.userId) {
      const supabase = await createClient();
      await supabase.from("push_subscriptions").upsert(
        {
          user_id: body.userId,
          endpoint: body.subscription.endpoint,
          p256dh: body.subscription.keys.p256dh,
          auth: body.subscription.keys.auth,
        },
        { onConflict: "user_id,endpoint" },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Push subscribe error:", error);
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!configureWebPush()) {
      return NextResponse.json({ error: "Push not configured" }, { status: 503 });
    }

    const body = (await request.json()) as {
      subscription: {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      title: string;
      body: string;
      url?: string;
    };

    await webpush.sendNotification(
      {
        endpoint: body.subscription.endpoint,
        keys: body.subscription.keys,
      },
      JSON.stringify({
        title: body.title,
        body: body.body,
        url: body.url ?? "/",
      }),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Push send error:", error);
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 });
  }
}
