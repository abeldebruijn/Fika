'use client'

import { useEffect, useRef, useState } from 'react'
import vocabulary from '../words.json'
import { initialProgress } from '../learning'
import { loadProgress, saveProgress } from '../storage'

export default function LocalModelTest() {
  const worker = useRef(null)
  const [supported, setSupported] = useState(null)
  const [status, setStatus] = useState('Nog niet gestart')
  const [progress, setProgress] = useState(null)
  const [words, setWords] = useState('jag, vill, ha, kaffe, nu')
  const [output, setOutput] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [errors, setErrors] = useState([])
  const [gatewaySentence, setGatewaySentence] = useState(null)

  function report(error) {
    setErrors(current => [...current, { time: new Date().toLocaleTimeString(), ...error }])
    setBusy(false)
    setStatus('Er is een fout opgetreden')
  }

  useEffect(() => {
    setSupported({
      worker: typeof Worker !== 'undefined',
      wasm: typeof WebAssembly !== 'undefined',
      gpu: !!navigator.gpu,
      agent: navigator.userAgent,
    })
    loadProgress().then(saved => {
      if (!saved) return
      const learned = Object.entries(saved.words ?? {}).filter(([, value]) => value.first)
        .map(([id]) => vocabulary[Number(id)]?.[0]).filter(Boolean).slice(0, 20)
      if (learned.length >= 3) setWords(learned.join(', '))
    }).catch(() => {})
    return () => worker.current?.terminate()
  }, [])

  async function generateGateway() {
    setErrors([])
    setBusy(true)
    setOutput('')
    setGatewaySentence(null)
    setStatus('Reiszin maken via Vercel AI Gateway…')
    try {
      const result = await fetch('/api/zin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words, maxWords: 6 }),
      })
      const data = await result.json()
      if (!result.ok) throw Object.assign(new Error(data.error ?? 'Geen antwoord van AI Gateway'), {
        name: data.code ?? `HTTP_${result.status}`, detail: data.detail,
      })
      setGatewaySentence(data)
      setOutput(data.swedish)
      setStatus(`Zin gegenereerd via ${data.model}`)
      setBusy(false)
    } catch (error) {
      report({ name: error.name, message: error.message, stack: error.detail ? JSON.stringify(error.detail, null, 2) : error.stack })
    }
  }

  async function practiceSentence() {
    if (!gatewaySentence) return
    try {
      const progress = (await loadProgress()) ?? initialProgress
      await saveProgress({ ...progress, generatedPending: {
        id: `g-${Date.now()}`, swedish: gatewaySentence.swedish, dutch: gatewaySentence.dutch,
      } })
      window.location.href = `/les?sectie=${(progress.section ?? 0) + 1}`
    } catch (error) {
      report({ name: error.name, message: error.message, stack: error.stack })
    }
  }

  function start(type) {
    setErrors([])
    setBusy(true)
    setProgress(null)
    setOutput('')
    setGatewaySentence(null)
    try {
      if (!worker.current) {
        const instance = new Worker(new URL('../llm-worker.js', import.meta.url), { type: 'module' })
        worker.current = instance
        instance.onmessage = ({ data }) => {
          if (data.type === 'status') setStatus(data.message)
          if (data.type === 'progress') setProgress(data)
          if (data.type === 'ready') { setReady(true); setBusy(false); setStatus('Model geladen op dit apparaat') }
          if (data.type === 'result') { setOutput(data.output); setBusy(false); setStatus('Zin gegenereerd') }
          if (data.type === 'error') report(data)
        }
        instance.onerror = event => report({ name: 'WorkerError', message: event.message || 'De modelworker kon niet starten', stack: `${event.filename ?? ''}:${event.lineno ?? ''}` })
        instance.onmessageerror = () => report({ name: 'MessageError', message: 'Het antwoord van de modelworker kon niet worden gelezen.' })
      }
      setStatus(type === 'generate' ? 'Model laden en zin maken…' : 'Model laden…')
      worker.current.postMessage({ type, words })
    } catch (error) {
      report({ name: error.name, message: error.message, stack: error.stack })
    }
  }

  return <main className="model-test">
    <a href="/instellingen">← Instellingen</a>
    <p className="eyebrow">MAAK EEN NIEUWE REISZIN</p>
    <h1>Een zin met jouw woorden</h1>
    <p>Maak een nieuwe Zweedse reiszin met woorden die je al hebt geleerd. Via Vercel AI Gateway worden de gekozen woorden naar een taalmodel gestuurd. Je voortgang blijft lokaal in deze browser.</p>
    <section className="model-panel">
      <h2>Vercel AI Gateway</h2>
      <p>Gemini 3.8 Flash maakt een korte zin met Nederlandse vertaling. Je kunt de zin daarna meteen oefenen.</p>
      <label htmlFor="model-words">Zweedse woorden voor je reiszin</label>
      <textarea id="model-words" value={words} onChange={event => setWords(event.target.value)} rows={3} />
      <div className="model-buttons"><button onClick={generateGateway} disabled={busy || !words.trim()}>Maak een reiszin</button></div>
      {gatewaySentence && <div className="model-output"><small>ZWEEDS · {gatewaySentence.model}</small><p lang="sv">{gatewaySentence.swedish}</p><p>{gatewaySentence.dutch}</p><button className="practice-sentence" onClick={practiceSentence}>Oefen deze zin →</button></div>}
      <p role="status" className="model-status">{status}</p>
      {errors.length > 0 && <section className="model-errors" role="alert"><h2>Foutdetails</h2>{errors.map((error, index) => <div key={index}><strong>{error.time} · {error.name}</strong><pre>{error.message}{error.stack ? `\n\n${error.stack}` : ''}</pre></div>)}<button onClick={() => navigator.clipboard.writeText(JSON.stringify({ errors, browser: supported?.agent }, null, 2)).catch(error => report({ name: error.name, message: error.message }))}>Kopieer foutdetails</button></section>}
    </section>
    <section className="model-panel">
      <h2>Experimenteel lokaal model</h2>
      <p>Deze proef draait alleen op je iPhone. Het kleine model kan onzinnige zinnen maken en moet eerst bestanden downloaden.</p>
      <dl><div><dt>Web Workers</dt><dd>{supported ? supported.worker ? 'Beschikbaar' : 'Niet beschikbaar' : 'Controleren…'}</dd></div><div><dt>WebAssembly</dt><dd>{supported ? supported.wasm ? 'Beschikbaar' : 'Niet beschikbaar' : 'Controleren…'}</dd></div><div><dt>WebGPU</dt><dd>{supported ? supported.gpu ? 'Beschikbaar' : 'Niet beschikbaar' : 'Controleren…'}</dd></div><div><dt>Rekenmethode</dt><dd>WebAssembly op je apparaat</dd></div></dl>
      <div className="model-buttons"><button onClick={() => start('load')} disabled={busy || ready || !supported?.worker || !supported?.wasm}>Model laden</button><button onClick={() => start('generate')} disabled={busy || !words.trim() || !supported?.worker || !supported?.wasm}>Maak een testzin</button></div>
      {progress && <div><progress value={progress.progress || 0} max="100" /> <small>{progress.file || 'Bestand'} · {Math.round(progress.progress || 0)}%</small></div>}
      {output && !gatewaySentence && <div className="model-output"><small>LOKALE TESTZIN</small><p lang="sv">{output}</p></div>}
    </section>
    <p className="model-note">Een gegenereerde zin komt na een fout antwoord later terug in je les.</p>
  </main>
}
