import { useState, useEffect } from 'react'
import AuthForm from './AuthForm.jsx'
import Chat from './Chat.jsx'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('chat_token')
    const userStr = localStorage.getItem('chat_user')
    if (token && userStr) {
      try {
        const parsedUser = JSON.parse(userStr)
        setUser(parsedUser)
        setIsLoggedIn(true)
      } catch (e) {
        localStorage.removeItem('chat_token')
        localStorage.removeItem('chat_user')
      }
    }
  }, [])

  const handleLogin = (token, userData) => {
    localStorage.setItem('chat_token', token)
    localStorage.setItem('chat_user', JSON.stringify(userData))
    setUser(userData)
    setIsLoggedIn(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('chat_token')
    localStorage.removeItem('chat_user')
    setUser(null)
    setIsLoggedIn(false)
  }

  return (
    <div>
      {isLoggedIn ? <Chat user={user} onLogout={handleLogout} /> : <AuthForm onLogin={handleLogin} />}
    </div>
  )
}

export default App