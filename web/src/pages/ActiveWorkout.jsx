import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import * as api from '../api'
import { playCountdownBeep, playSetReadyBeep, playSessionStart } from '../utils/sounds'

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  if (h > 0) return `${String(h).padStart(2, '0')}:${mm}:${ss}`
  return `${mm}:${ss}`
}

export default function ActiveWorkout() {
  const { planId } = useParams()
  const [searchParams] = useSearchParams()
  const programId = searchParams.get('program')
  const navigate = useNavigate()

  const [plan, setPlan] = useState(null)
  const [session, setSession] = useState(null)
  const [currentExIdx, setCurrentExIdx] = useState(0)
  const [loggedSets, setLoggedSets] = useState({})
  const [elapsed, setElapsed] = useState(0)
  const [restSeconds, setRestSeconds] = useState(null)
  const [currentReps, setCurrentReps] = useState('')
  const [currentWeight, setCurrentWeight] = useState('')
  const [currentRpe, setCurrentRpe] = useState('')
  const [currentRir, setCurrentRir] = useState('')
  const [finishing, setFinishing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [preWorkoutCountdown, setPreWorkoutCountdown] = useState(5) // 5 seconds
  const [isWarmup, setIsWarmup] = useState(false) // Track if current set is warmup
  const [notes, setNotes] = useState('') // Session notes

  const sessionRef = useRef(null)
  const soundPlayedRef = useRef(new Set()) // Track which countdown seconds have played sounds

  useEffect(() => {
    async function init() {
      try {
        const planData = await api.getPlan(planId)
        const sessionData = await api.startSession(parseInt(planId), programId ? parseInt(programId) : null)
        setPlan(planData)
        setSession(sessionData)
        sessionRef.current = sessionData
        if (planData.plan_exercises.length > 0) {
          const pe = planData.plan_exercises[0]
          setCurrentReps(String(pe.reps))
          setCurrentWeight(String(pe.weight))
        }
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [planId, programId])

  // Pre-workout countdown
  useEffect(() => {
    if (!session || preWorkoutCountdown === null) return
    if (preWorkoutCountdown <= 0) {
      playSessionStart()
      setPreWorkoutCountdown(null) // End countdown
      return
    }
    
    // Play beep for countdown seconds
    if (!soundPlayedRef.current.has(`pre-${preWorkoutCountdown}`)) {
      soundPlayedRef.current.add(`pre-${preWorkoutCountdown}`)
      playCountdownBeep()
    }
    
    const t = setTimeout(() => setPreWorkoutCountdown(p => p - 1), 1000)
    return () => clearTimeout(t)
  }, [preWorkoutCountdown, session])

  // Workout clock
  useEffect(() => {
    if (!session || finishing) return
    const interval = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(interval)
  }, [session, finishing])

  // Rest countdown
  useEffect(() => {
    if (restSeconds === null || restSeconds <= 0) {
      if (restSeconds === 0) {
        playSetReadyBeep()
        setRestSeconds(null)
      }
      return
    }
    
    // Play beep for last 5 seconds
    if (restSeconds <= 5 && !soundPlayedRef.current.has(restSeconds)) {
      soundPlayedRef.current.add(restSeconds)
      playCountdownBeep()
    }
    
    const t = setTimeout(() => setRestSeconds(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [restSeconds])

  const currentPE = plan?.plan_exercises[currentExIdx]
  const setsForCurrent = currentPE ? (loggedSets[currentPE.id] || []) : []
  const previousSet = setsForCurrent.length > 0 ? setsForCurrent[setsForCurrent.length - 1] : null
  const allSetsLogged = setsForCurrent.length >= (currentPE?.sets || 0)
  const isResting = restSeconds !== null

  function getDoneCount(pe) {
    return (loggedSets[pe.id] || []).length
  }

  function getSupersetPairIndex(idx) {
    if (!plan || !plan.plan_exercises || plan.plan_exercises.length < 2) return null
    const candidate = idx % 2 === 0 ? idx + 1 : idx - 1
    if (candidate < 0 || candidate >= plan.plan_exercises.length) return null
    return candidate
  }

  function getNextIncompleteExerciseIndex() {
    if (!plan) return null
    for (let i = 0; i < plan.plan_exercises.length; i++) {
      const pe = plan.plan_exercises[i]
      if (getDoneCount(pe) < pe.sets) return i
    }
    return null
  }

  function adjustNumberValue(value, delta, { min = -Infinity, max = Infinity, step = 1, decimals = 0 } = {}) {
    const current = value === '' ? 0 : parseFloat(value)
    const safe = Number.isFinite(current) ? current : 0
    const next = Math.max(min, Math.min(max, safe + delta * step))
    return decimals > 0 ? next.toFixed(decimals) : String(Math.round(next))
  }

  function duplicatePreviousSet() {
    if (!previousSet) return
    setCurrentReps(String(previousSet.reps_done ?? currentReps))
    setCurrentWeight(String(previousSet.weight_used ?? currentWeight))
    setCurrentRpe(previousSet.rpe == null ? '' : String(previousSet.rpe))
    setCurrentRir(previousSet.rir == null ? '' : String(previousSet.rir))
    setIsWarmup(Boolean(previousSet.is_warmup))
  }

  function onSetFormSubmit(e) {
    e.preventDefault()
    if (!isResting) {
      logSet()
    }
  }

  async function logSet() {
    const reps = parseInt(currentReps)
    const weight = parseFloat(currentWeight) || 0
    const rpe = currentRpe === '' ? null : parseFloat(currentRpe)
    const rir = currentRir === '' ? null : parseFloat(currentRir)
    if (!currentPE || isNaN(reps) || reps < 1) return

    const setNumber = setsForCurrent.length + 1
    await api.logSet(session.id, {
      plan_exercise_id: currentPE.id,
      set_number: setNumber,
      reps_done: reps,
      weight_used: weight,
      rpe: rpe,
      rir: rir,
      is_warmup: isWarmup,
    })

    setLoggedSets(prev => ({
      ...prev,
      [currentPE.id]: [...(prev[currentPE.id] || []), { set_number: setNumber, reps_done: reps, weight_used: weight, rpe: rpe, rir: rir, is_warmup: isWarmup }],
    }))
    soundPlayedRef.current.clear() // Reset sound tracking for new rest period

    const scheme = plan.scheme_type || 'straight'
    if (scheme === 'superset') {
      const pairIdx = getSupersetPairIndex(currentExIdx)
      const pairPe = pairIdx !== null ? plan.plan_exercises[pairIdx] : null

      if (pairPe) {
        const pairDone = getDoneCount(pairPe)
        const pairNeedsThisRound = pairDone < setNumber && pairDone < pairPe.sets

        if (pairNeedsThisRound) {
          goToExercise(pairIdx)
          setRestSeconds(null)
        } else {
          setRestSeconds(plan.rest_time)
          const nextIncomplete = getNextIncompleteExerciseIndex()
          if (nextIncomplete !== null && nextIncomplete !== currentExIdx) {
            goToExercise(nextIncomplete)
          }
        }
      } else {
        setRestSeconds(plan.rest_time)
      }
    } else {
      setRestSeconds(plan.rest_time)
    }

    setIsWarmup(false) // Reset warmup flag for next set
    setCurrentRpe('')
    setCurrentRir('')
  }

  function goToExercise(idx) {
    setCurrentExIdx(idx)
    const pe = plan.plan_exercises[idx]
    setCurrentReps(String(pe.reps))
    setCurrentWeight(String(pe.weight))
    setRestSeconds(null)
  }

  async function finishWorkout() {
    setFinishing(true)
    try {
      // Update session notes if provided
      if (notes.trim()) {
        await api.updateSessionNotes(session.id, notes)
      }
      await api.finishSession(session.id)
      navigate(`/session/${session.id}/summary`)
    } catch (e) {
      alert('Error finishing workout: ' + e.message)
      setFinishing(false)
    }
  }

  if (loading) return <div className="loading">Starting workout…</div>
  if (error) return <div className="container"><div className="error">{error}</div></div>
  if (!plan?.plan_exercises?.length) {
    return <div><p style={{ color: 'var(--muted)' }}>This plan has no exercises configured.</p></div>
  }

  // Pre-workout countdown screen
  if (preWorkoutCountdown !== null) {
    const minutes = Math.floor(preWorkoutCountdown / 60)
    const seconds = preWorkoutCountdown % 60
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg)',
        padding: '2rem',
      }}>
        <h1 style={{ marginBottom: '2rem', color: 'var(--muted)', fontSize: '1.2rem' }}>Get ready!</h1>
        <div style={{
          fontSize: '8rem',
          fontWeight: 900,
          color: 'var(--accent)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '2px',
        }}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
        <p style={{ marginTop: '2rem', color: 'var(--muted)', fontSize: '1.1rem' }}>
          Prepare yourself and your workspace
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="workout-header">
        <h1>{plan.name}</h1>
        <div className="workout-timer">{formatTime(elapsed)}</div>
      </div>

      <div className="workout-layout">
        {/* Sidebar: exercise list */}
        <nav className="exercise-nav">
          {plan.plan_exercises.map((pe, idx) => {
            const done = (loggedSets[pe.id] || []).length
            const total = pe.sets
            return (
              <button
                key={pe.id}
                className={`nav-exercise ${idx === currentExIdx ? 'active' : ''} ${done >= total ? 'complete' : ''}`}
                onClick={() => goToExercise(idx)}
              >
                <span className="nav-exercise-name">{pe.exercise.name}</span>
                <span className="nav-exercise-progress">{done}/{total}</span>
              </button>
            )
          })}
        </nav>

        {/* Main exercise card */}
        <div className="exercise-panel">
          <div className="card">
            <h2>{currentPE.exercise.name}</h2>
            {currentPE.exercise.muscle_group && (
              <p className="muscle-group">{currentPE.exercise.muscle_group}</p>
            )}
            <p className="target-info">
              Target: <strong>{currentPE.sets} sets × {currentPE.reps} reps @ {currentPE.weight} kg</strong>
            </p>
            {plan.scheme_type === 'superset' && (
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '-0.5rem', marginBottom: '0.9rem' }}>
                Superset mode enabled (adjacent exercise pairs: 1-2, 3-4, ...). Auto-switch active.
              </p>
            )}

            {setsForCurrent.length > 0 && (
              <table style={{ marginBottom: '1rem' }}>
                <thead>
                  <tr><th>Set</th><th>Reps done</th><th>Weight</th><th>RPE</th><th>RIR</th></tr>
                </thead>
                <tbody>
                  {setsForCurrent.map(s => (
                    <tr key={s.set_number}>
                      <td>{s.set_number}</td>
                      <td>{s.reps_done}</td>
                      <td>{s.weight_used} kg</td>
                      <td>{s.rpe ?? '—'}</td>
                      <td>{s.rir ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {!allSetsLogged && (
              <div className="log-set">
                <h3>Log set {setsForCurrent.length + 1} of {currentPE.sets}</h3>
                <div className={`log-set-body ${isResting ? 'is-resting' : ''}`}>
                  <form className="set-form" onSubmit={onSetFormSubmit}>
                    <label className="number-field">
                      Reps
                      <div className="stepper">
                        <button type="button" className="btn-step" onClick={() => setCurrentReps(v => adjustNumberValue(v, -1, { min: 1, step: 1 }))} disabled={isResting}>-</button>
                        <input
                          type="number"
                          min="1"
                          value={currentReps}
                          onChange={e => setCurrentReps(e.target.value)}
                          disabled={isResting}
                        />
                        <button type="button" className="btn-step" onClick={() => setCurrentReps(v => adjustNumberValue(v, 1, { min: 1, step: 1 }))} disabled={isResting}>+</button>
                      </div>
                    </label>
                    <label className="number-field">
                      Weight (kg)
                      <div className="stepper">
                        <button type="button" className="btn-step" onClick={() => setCurrentWeight(v => adjustNumberValue(v, -1, { min: 0, step: 0.5, decimals: 1 }))} disabled={isResting}>-</button>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={currentWeight}
                          onChange={e => setCurrentWeight(e.target.value)}
                          disabled={isResting}
                        />
                        <button type="button" className="btn-step" onClick={() => setCurrentWeight(v => adjustNumberValue(v, 1, { min: 0, step: 0.5, decimals: 1 }))} disabled={isResting}>+</button>
                      </div>
                    </label>
                    <label className="number-field">
                      RPE (optional)
                      <div className="stepper">
                        <button type="button" className="btn-step" onClick={() => setCurrentRpe(v => adjustNumberValue(v, -1, { min: 1, max: 10, step: 0.5, decimals: 1 }))} disabled={isResting}>-</button>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          step="0.5"
                          value={currentRpe}
                          onChange={e => setCurrentRpe(e.target.value)}
                          disabled={isResting}
                        />
                        <button type="button" className="btn-step" onClick={() => setCurrentRpe(v => adjustNumberValue(v, 1, { min: 1, max: 10, step: 0.5, decimals: 1 }))} disabled={isResting}>+</button>
                      </div>
                    </label>
                    <label className="number-field">
                      RIR (optional)
                      <div className="stepper">
                        <button type="button" className="btn-step" onClick={() => setCurrentRir(v => adjustNumberValue(v, -1, { min: 0, max: 10, step: 0.5, decimals: 1 }))} disabled={isResting}>-</button>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.5"
                          value={currentRir}
                          onChange={e => setCurrentRir(e.target.value)}
                          disabled={isResting}
                        />
                        <button type="button" className="btn-step" onClick={() => setCurrentRir(v => adjustNumberValue(v, 1, { min: 0, max: 10, step: 0.5, decimals: 1 }))} disabled={isResting}>+</button>
                      </div>
                    </label>
                    <label className="warmup-toggle">
                      <input
                        type="checkbox"
                        checked={isWarmup}
                        onChange={e => setIsWarmup(e.target.checked)}
                        disabled={isResting}
                      />
                      <span>Warmup set (exclude from progression)</span>
                    </label>
                    <div className="set-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={duplicatePreviousSet}
                        disabled={isResting || !previousSet}
                        title={previousSet ? 'Copy reps/weight/RPE/RIR from previous set' : 'No previous set to copy'}
                      >
                        Duplicate Prev
                      </button>
                      <button type="submit" className="btn-primary" disabled={isResting}>✔ Log Set</button>
                    </div>
                  </form>

                  {isResting && (
                    <div className="rest-overlay">
                      <div className="rest-timer">
                        Rest: <strong>{formatTime(restSeconds)}</strong>
                        {restSeconds <= 5 && (
                          <span style={{ color: 'var(--danger)', marginLeft: '0.5rem', fontWeight: 700 }}>
                            {restSeconds}
                          </span>
                        )}
                        <button className="btn-secondary" onClick={() => {
                          soundPlayedRef.current.clear()
                          setRestSeconds(null)
                        }}>Skip</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {allSetsLogged && (
              <div className="exercise-complete">
                ✓ All sets complete!
                {currentExIdx < plan.plan_exercises.length - 1 && (
                  <button className="btn-primary" onClick={() => goToExercise(currentExIdx + 1)}>
                    Next Exercise →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="workout-footer">
        <div style={{ width: '100%', marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Session notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="How did you feel? Any observations?"
            style={{
              width: '100%',
              minHeight: '80px',
              padding: '0.75rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text)',
              fontFamily: 'inherit',
              fontSize: '0.95rem',
              resize: 'vertical',
            }}
          />
        </div>
        <button className="btn-finish" onClick={finishWorkout} disabled={finishing}>
          {finishing ? 'Saving…' : 'Finish Workout'}
        </button>
      </div>
    </div>
  )
}
