'use client'

import { useState } from 'react'
import { clearProgress } from '../storage'

export default function Settings() {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [cleared, setCleared] = useState(false)

  async function reset() {
    try {
      await clearProgress()
      setConfirming(false)
      setCleared(true)
      setError('')
    } catch {
      setError('Wissen is niet gelukt. Controleer of Safari opslag voor deze site toestaat.')
    }
  }

  return <main className="settings-page">
    <a href="/" className="back">← Terug naar oefenen</a>
    <h1>Instellingen</h1>
    <section className="settings-panel">
      <h2>Opnieuw beginnen</h2>
      <p>Wis je opgeslagen voortgang op dit apparaat. Je begint weer bij de eerste woorden en zinnen. Je dagdoel wordt teruggezet naar 5.</p>
      {!confirming ? <button onClick={() => setConfirming(true)}>Voortgang wissen</button> :
        <div className="confirm-reset">
          <p>Weet je zeker dat je alle lokale voortgang wilt wissen?</p>
          <button className="danger" onClick={reset}>Ja, wis alles</button>
          <button onClick={() => setConfirming(false)}>Annuleren</button>
        </div>}
      {error && <p role="alert">{error}</p>}
      {cleared && <p role="status">Je voortgang is gewist. <a href="/">Begin opnieuw</a></p>}
    </section>
  </main>
}
