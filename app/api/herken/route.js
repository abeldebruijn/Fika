import { transcribe } from 'ai'

export const runtime = 'nodejs'

export async function POST(request) {
  try {
    const form = await request.formData()
    const audio = form.get('audio')
    if (!(audio instanceof File) || audio.size < 500 || audio.size > 2_000_000 ||
      !/^(audio\/(mp4|mpeg|webm|ogg|wav|x-m4a|aac)|video\/mp4)/i.test(audio.type)) {
      return Response.json({ error: 'Neem een korte zin op (maximaal 2 MB).' }, { status: 400 })
    }
    const result = await transcribe({
      model: 'google/gemini-3.5-transcribe',
      audio: new Uint8Array(await audio.arrayBuffer()),
      abortSignal: AbortSignal.timeout(25000),
    })
    const text = result.text?.trim()
    if (!text) return Response.json({ error: 'Geen spraak herkend. Probeer het nog eens.' }, { status: 422 })
    return Response.json({ text, model: 'google/gemini-3.5-transcribe' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Gemini transcription failed', error)
    return Response.json({ error: 'Herkennen van de opname lukte niet. Probeer het opnieuw.' }, { status: 502 })
  }
}
