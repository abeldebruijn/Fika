export const runtime = 'nodejs'

const model = 'google/gemini-3.8-flash'

function response(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function tokens(text) {
  return text.toLocaleLowerCase('sv').match(/\p{L}+/gu) ?? []
}

export async function POST(request) {
  try {
    const raw = await request.text()
    if (raw.length > 2000) return response({ error: 'Te veel invoer.' }, 413)
    const input = JSON.parse(raw)
    const words = [...new Set(String(input.words ?? '').toLocaleLowerCase('sv')
      .split(/[,\s]+/).map(word => word.trim()).filter(word => /^[a-zåäö]{1,24}$/i.test(word)))].slice(0, 20)
    if (words.length < 3) return response({ error: 'Geef minstens drie Zweedse woorden op.' }, 400)
    const maxWords = Math.max(3, Math.min(8, Number(input.maxWords) || 6))
    const credential = process.env.AI_GATEWAY_API_KEY || request.headers.get('x-vercel-oidc-token') || process.env.VERCEL_OIDC_TOKEN
    if (!credential) return response({ error: 'AI Gateway is hier nog niet beschikbaar: OIDC-token ontbreekt.', code: 'AUTH_MISSING' }, 503)

    const gateway = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        max_tokens: 1000,
        reasoning: { effort: 'low' },
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: `Je bent een nauwkeurige docent Zweeds voor Nederlanders op reis. Geef uitsluitend een JSON-object met twee strings: "sv" en "nl". Schrijf één natuurlijke, bruikbare reiszin van 3 tot ${maxWords} Zweedse woorden en een correcte Nederlandse vertaling. Gebruik minstens twee van de opgegeven Zweedse woorden letterlijk, indien mogelijk. Vermijd herhaling, verzonnen woorden en uitleg.` },
          { role: 'user', content: `Geleerde Zweedse woorden: ${words.join(', ')}. Een zin die nuttig is op reis in Zweden.` },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    })
    const data = await gateway.json().catch(() => ({}))
    if (!gateway.ok) {
      const detail = typeof data.error?.message === 'string' ? data.error.message.slice(0, 250) : 'De aanvraag is afgewezen.'
      return response({ error: `AI Gateway (${gateway.status}): ${detail}`, code: data.error?.code ?? 'GATEWAY_ERROR' }, 502)
    }
    let content = data.choices?.[0]?.message?.content
    if (Array.isArray(content)) content = content.map(part => part.text ?? '').join('')
    const parsed = JSON.parse(String(content ?? '').replace(/^```(?:json)?\s*|\s*```$/g, ''))
    const sv = String(parsed.sv ?? '').trim()
    const nl = String(parsed.nl ?? '').trim()
    const swedishWords = tokens(sv)
    const dutchWords = tokens(nl)
    const knownCount = swedishWords.filter(word => words.includes(word)).length
    if (swedishWords.length < 3 || swedishWords.length > maxWords || dutchWords.length < 2 || dutchWords.length > 14 ||
      new Set(swedishWords).size < Math.ceil(swedishWords.length / 2) || knownCount < 2 ||
      /[\n{}<>]/.test(sv + nl)) {
      return response({ error: 'Het model maakte geen geschikte reiszin. Probeer het opnieuw.', code: 'OUTPUT_QUALITY', detail: { sv, nl } }, 422)
    }
    return response({ swedish: sv, dutch: nl, model })
  } catch (error) {
    if (error?.name === 'SyntaxError') return response({ error: 'De aanvraag of het modelantwoord bevat ongeldige JSON.', code: 'INVALID_JSON' }, 422)
    if (error?.name === 'TimeoutError') return response({ error: 'Het model reageerde niet binnen 20 seconden.', code: 'TIMEOUT' }, 504)
    return response({ error: 'De aanvraag kon niet worden uitgevoerd.', code: 'REQUEST_FAILED' }, 500)
  }
}
