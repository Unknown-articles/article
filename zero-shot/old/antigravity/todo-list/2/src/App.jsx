import React from 'react'
import './index.css'
import { TaskForm } from './components/TaskForm'

function App() {
  return (
    <div className="app-container">
      <h1>React To-Do List</h1>
      <TaskForm />
    </div>
  )
}

export default App
