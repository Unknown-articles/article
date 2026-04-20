import AuthForm from './AuthForm';
import Chat from './components/Chat';
import { useAuth } from './useAuth';

export default function App() {
  const { session, saveSession, logout } = useAuth();

  if (session) {
    return <Chat session={session} onLogout={logout} />;
  }

  return <AuthForm onSuccess={saveSession} />;
}
