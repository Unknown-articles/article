import { useState, useEffect } from 'react'
import SignInForm from './AuthForm.jsx'
import MessageRoom from './Chat.jsx'

function MyApp() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [account, setAccount] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('chat_token')
    const userStr = localStorage.getItem('chat_user')
    if (token && userStr) {
      try {
        const parsedUser = JSON.parse(userStr)
        setAccount(parsedUser)
        setLoggedIn(true)
      } catch (e) {
        localStorage.removeItem('chat_token')
        localStorage.removeItem('chat_user')
      }
    }
  }, [])

  const loginHandler = (token, userData) => {
    localStorage.setItem('chat_token', token)
    localStorage.setItem('chat_user', JSON.stringify(userData))
    setAccount(userData)
    setLoggedIn(true)
  }

  const logoutHandler = () => {
    localStorage.removeItem('chat_token')
    localStorage.removeItem('chat_user')
    setAccount(null)
    setLoggedIn(false)
  }

  return (
    <div>
      {loggedIn ? <MessageRoom account={account} onLogout={logoutHandler} /> : <SignInForm onLogin={loginHandler} />}
    </div>
  )
}

export default MyApp