const BASE = '/api'

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

// Exercises
export const getExercises = () => request('GET', '/exercises')
export const createExercise = (data) => request('POST', '/exercises', data)
export const updateExercise = (id, data) => request('PUT', `/exercises/${id}`, data)
export const deleteExercise = (id) => request('DELETE', `/exercises/${id}`)

// Plans
export const getPlans = () => request('GET', '/plans')
export const getPlan = (id) => request('GET', `/plans/${id}`)
export const createPlan = (data) => request('POST', '/plans', data)
export const updatePlan = (id, data) => request('PUT', `/plans/${id}`, data)
export const deletePlan = (id) => request('DELETE', `/plans/${id}`)

// Plan exercises
export const addPlanExercise = (planId, data) => request('POST', `/plans/${planId}/exercises`, data)
export const updatePlanExercise = (peId, data) => request('PUT', `/plan-exercises/${peId}`, data)
export const deletePlanExercise = (peId) => request('DELETE', `/plan-exercises/${peId}`)

// Programs
export const getPrograms = () => request('GET', '/programs')
export const getProgram = (id) => request('GET', `/programs/${id}`)
export const createProgram = (data) => request('POST', '/programs', data)
export const updateProgram = (id, data) => request('PUT', `/programs/${id}`, data)
export const deleteProgram = (id) => request('DELETE', `/programs/${id}`)
export const getProgramProgress = (id) => request('GET', `/programs/${id}/progress`)

// Sessions
export const startSession = (planId, programId) => request('POST', '/sessions', { plan_id: planId, program_id: programId })
export const finishSession = (id) => request('POST', `/sessions/${id}/finish`)
export const logSet = (sessionId, data) => request('POST', `/sessions/${sessionId}/sets`, data)
export const getSessionSummary = (id) => request('GET', `/sessions/${id}/summary`)
