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
  const [finishing, setFinishing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [preWorkoutCountdown, setPreWorkoutCountdown] = useState(5) // 5 seconds

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
  const allSetsLogged = setsForCurrent.length >= (currentPE?.sets || 0)

  async function logSet() {
    const reps = parseInt(currentReps)
    const weight = parseFloat(currentWeight) || 0
    if (!currentPE || isNaN(reps) || reps < 1) return

    const setNumber = setsForCurrent.length + 1
    await api.logSet(session.id, {
      plan_exercise_id: currentPE.id,
      set_number: setNumber,
      reps_done: reps,
      weight_used: weight,
    })

    setLoggedSets(prev => ({
      ...prev,
      [currentPE.id]: [...(prev[currentPE.id] || []), { set_number: setNumber, reps_done: reps, weight_used: weight }],
    }))
    soundPlayedRef.current.clear() // Reset sound tracking for new rest period
    setRestSeconds(plan.rest_time)
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

            {setsForCurrent.length > 0 && (
              <table style={{ marginBottom: '1rem' }}>
                <thead>
                  <tr><th>Set</th><th>Reps done</th><th>Weight</th></tr>
                </thead>
                <tbody>
                  {setsForCurrent.map(s => (
                    <tr key={s.set_number}>
                      <td>{s.set_number}</td>
                      <td>{s.reps_done}</td>
                      <td>{s.weight_used} kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {!allSetsLogged && (
              <div className="log-set">
                <h3>Log set {setsForCurrent.length + 1} of {currentPE.sets}</h3>
                {restSeconds !== null ? (
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
                ) : (
                  <div className="set-form">
                    <label>
                      Reps
                      <input
                        type="number"
                        min="1"
                        value={currentReps}
                        onChange={e => setCurrentReps(e.target.value)}
                      />
                    </label>
                    <label>
                      Weight (kg)
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={currentWeight}
                        onChange={e => setCurrentWeight(e.target.value)}
                      />
                    </label>
                    <button className="btn-primary" onClick={logSet}>✔ Log Set</button>
                  </div>
                )}
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
        <button className="btn-finish" onClick={finishWorkout} disabled={finishing}>
          {finishing ? 'Saving…' : 'Finish Workout'}
        </button>
      </div>
    </div>
  )
}
