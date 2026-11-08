'use client'

import { useEffect, useRef, useState } from 'react'

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
    return () => worker.current?.terminate()
  }, [])

  function start(type) {
    setErrors([])
    setBusy(true)
    setProgress(null)
    setOutput('')
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
    <p className="eyebrow">EXPERIMENT · OP JE APPARAAT</p>
    <h1>Test een lokaal taalmodel</h1>
    <p>Deze pagina test of Safari op jouw iPhone zelf een Zweedse zin kan maken. Het model wordt bij de eerste start gedownload en kan veel opslag en geheugen gebruiken. Je ingevoerde woorden blijven in de browser.</p>
    <section className="model-panel">
      <h2>Ondersteuning</h2>
      <dl><div><dt>Web Workers</dt><dd>{supported ? supported.worker ? 'Beschikbaar' : 'Niet beschikbaar' : 'Controleren…'}</dd></div><div><dt>WebAssembly</dt><dd>{supported ? supported.wasm ? 'Beschikbaar' : 'Niet beschikbaar' : 'Controleren…'}</dd></div><div><dt>WebGPU</dt><dd>{supported ? supported.gpu ? 'Beschikbaar' : 'Niet beschikbaar' : 'Controleren…'}</dd></div><div><dt>Rekenmethode</dt><dd>WebAssembly op je apparaat</dd></div></dl>
      <label htmlFor="model-words">Woorden voor de proefzin</label>
      <textarea id="model-words" value={words} onChange={event => setWords(event.target.value)} rows={3} />
      <div className="model-buttons"><button onClick={() => start('load')} disabled={busy || ready || !supported?.worker || !supported?.wasm}>Model laden</button><button onClick={() => start('generate')} disabled={busy || !words.trim() || !supported?.worker || !supported?.wasm}>Maak een testzin</button></div>
      <p role="status" className="model-status">{status}</p>
      {progress && <div><progress value={progress.progress || 0} max="100" /> <small>{progress.file || 'Bestand'} · {Math.round(progress.progress || 0)}%</small></div>}
      {output && <div className="model-output"><small>GEGENEREERDE ZIN</small><p lang="sv">{output}</p></div>}
      {errors.length > 0 && <section className="model-errors" role="alert"><h2>Fouten op dit apparaat</h2><p>Je kunt deze details kopiëren wanneer we de fout samen willen oplossen.</p>{errors.map((error, index) => <div key={index}><strong>{error.time} · {error.name}</strong><pre>{error.message}{error.stack ? `\n\n${error.stack}` : ''}</pre></div>)}<button onClick={() => navigator.clipboard.writeText(JSON.stringify({ errors, browser: supported?.agent }, null, 2)).catch(error => report({ name: error.name, message: error.message }))}>Kopieer foutdetails</button></section>}
    </section>
    <p className="model-note">Dit is een losse test. Gegenereerde zinnen worden niet aan je lessen toegevoegd.</p>
  </main>
}
