import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Optional ElevenLabs text-to-speech proxy. When no key is configured the
 * route answers 204 so the client uses the browser's built-in voice instead.
 */
export async function POST(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5";

  if (!apiKey || !voiceId) {
    return new NextResponse(null, { status: 204 });
  }

  let text = "";
  try {
    const body = (await request.json()) as { text?: string };
    text = (body.text ?? "").slice(0, 1200);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!text.trim()) return new NextResponse(null, { status: 204 });

  try {
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!upstream.ok || !upstream.body) {
      return new NextResponse(null, { status: 204 });
    }

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
