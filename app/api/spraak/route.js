import { generateSpeech } from 'ai'

export const runtime = 'nodejs'

export async function POST(request) {
  let text
  try {
    const body = await request.json()
    text = String(body.text ?? '').trim()
  } catch {
    return Response.json({ error: 'Ongeldige tekst.' }, { status: 400 })
  }
  if (!text || text.length > 160 || !/^[\p{L}\p{M}\s.,!?;:'’-]+$/u.test(text)) {
    return Response.json({ error: 'Geef een korte Zweedse zin op.' }, { status: 400 })
  }
  try {
    const result = await generateSpeech({
      model: 'google/gemini-3.8-flash-lite-tts',
      text,
      voice: 'Kore',
      instructions: 'Speak Swedish naturally, clearly and slightly slowly for a beginner learning Swedish. Say only the given words.',
      outputFormat: 'wav',
      abortSignal: AbortSignal.timeout(25000),
    })
    return new Response(result.audio.uint8Array, {
      headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'public, max-age=86400' },
    })
  } catch (error) {
    console.error('Gemini TTS failed', error)
    return Response.json({ error: 'De Zweedse uitspraak kon niet worden gemaakt.' }, { status: 502 })
  }
}
