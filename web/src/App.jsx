import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Plans from './pages/Plans'
import PlanEditor from './pages/PlanEditor'
import Programs from './pages/Programs'
import ProgramEditor from './pages/ProgramEditor'
import ProgramProgress from './pages/ProgramProgress'
import CycleComparison from './pages/CycleComparison'
import OneRMCalculator from './pages/OneRMCalculator'
import Export from './pages/Export'
import Consistency from './pages/Consistency'
import ActiveWorkout from './pages/ActiveWorkout'
import Summary from './pages/Summary'
import Exercises from './pages/Exercises'

export default function App() {
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'

  return (
    <BrowserRouter>
      <Header />
      <main className="container">
        <Routes>
          <Route path="/" element={<Plans />} />
          <Route path="/plans/new" element={<PlanEditor />} />
          <Route path="/plans/:id/edit" element={<PlanEditor />} />
          <Route path="/programs" element={<Programs />} />
          <Route path="/programs/new" element={<ProgramEditor />} />
          <Route path="/programs/:id/edit" element={<ProgramEditor />} />
          <Route path="/programs/:id/progress" element={<ProgramProgress />} />
          <Route path="/cycle-comparison" element={<CycleComparison />} />
          <Route path="/1rm" element={<OneRMCalculator />} />
          <Route path="/consistency" element={<Consistency />} />
          <Route path="/export" element={<Export />} />
          <Route path="/workout/:planId" element={<ActiveWorkout />} />
          <Route path="/session/:sessionId/summary" element={<Summary />} />
          <Route path="/exercises" element={<Exercises />} />
        </Routes>
      </main>
      <footer className="app-footer">{appVersion}</footer>
    </BrowserRouter>
  )
}
