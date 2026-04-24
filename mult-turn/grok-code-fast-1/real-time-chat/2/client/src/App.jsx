import { useState, useEffect } from 'react'
import LoginForm from './AuthForm.jsx'
import ChatRoom from './Chat.jsx'

function Application() {
  const [authenticated, setAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('chat_token')
    const userStr = localStorage.getItem('chat_user')
    if (token && userStr) {
      try {
        const parsedUser = JSON.parse(userStr)
        setCurrentUser(parsedUser)
        setAuthenticated(true)
      } catch (e) {
        localStorage.removeItem('chat_token')
        localStorage.removeItem('chat_user')
      }
    }
  }, [])

  const onLoginSuccess = (token, userData) => {
    localStorage.setItem('chat_token', token)
    localStorage.setItem('chat_user', JSON.stringify(userData))
    setCurrentUser(userData)
    setAuthenticated(true)
  }

  const onLogout = () => {
    localStorage.removeItem('chat_token')
    localStorage.removeItem('chat_user')
    setCurrentUser(null)
    setAuthenticated(false)
  }

  return (
    <div>
      {authenticated ? <ChatRoom currentUser={currentUser} onLogout={onLogout} /> : <LoginForm onLogin={onLoginSuccess} />}
    </div>
  )
}

export default Application