import { createHash } from 'node:crypto'
import { get, put } from '@vercel/blob'
import { generateSpeech } from 'ai'
import { sentences } from '../../sentences'
import words from '../../words.json'

export const runtime = 'nodejs'

const courseTexts = new Set([...sentences, ...words].map(([text]) => text))
const model = 'google/gemini-3.8-flash-lite-tts'
const voice = 'Kore'
const instructions = 'Speak Swedish naturally, clearly and slightly slowly for a beginner learning Swedish. Say only the given words.'
const outputFormat = 'wav'
const inFlight = new Map()

async function synthesize(text) {
  const result = await generateSpeech({
    model, voice, instructions, outputFormat, text,
    abortSignal: AbortSignal.timeout(25000),
  })
  return result.audio.uint8Array
}

async function courseAudio(text) {
  const hash = createHash('sha256').update(JSON.stringify([model, voice, instructions, outputFormat, text])).digest('hex')
  const path = `spraak/${hash}.wav`
  const access = 'public'
  const hasStore = process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID
  if (hasStore) {
    try {
      const blob = await get(path, { access, abortSignal: AbortSignal.timeout(3000) })
      if (blob?.statusCode === 200) {
        const audio = await new Response(blob.stream).arrayBuffer()
        return { audio, source: 'blob' }
      }
    } catch (error) {
      console.warn('Speech Blob read failed', error.name)
    }
  }

  const audio = await synthesize(text)
  if (hasStore) {
    try {
      await put(path, audio, {
        access, contentType: 'audio/wav', addRandomSuffix: false,
        abortSignal: AbortSignal.timeout(3000),
      })
      return { audio, source: 'generated' }
    } catch (error) {
      console.warn('Speech Blob write failed', error.name)
    }
  }
  return { audio, source: 'uncached' }
}

async function respond(text, shared) {
  try {
    let result
    if (shared) {
      let pending = inFlight.get(text)
      if (!pending) {
        pending = courseAudio(text).finally(() => inFlight.delete(text))
        inFlight.set(text, pending)
      }
      result = await pending
    } else {
      result = { audio: await synthesize(text), source: 'uncached' }
    }
    return new Response(result.audio, {
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': result.source === 'uncached' ? 'no-store' : 'public, max-age=86400',
        'X-Fika-Audio': result.source,
      },
    })
  } catch (error) {
    console.error('Gemini TTS failed', error)
    return Response.json({ error: 'De Zweedse uitspraak kon niet worden gemaakt.' }, { status: 502 })
  }
}

export function GET(request) {
  const text = new URL(request.url).searchParams.get('text')
  if (!courseTexts.has(text)) {
    return Response.json({ error: 'Deze tekst staat niet in de cursus.' }, { status: 404 })
  }
  return respond(text, true)
}

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
  return respond(text, courseTexts.has(text))
}
