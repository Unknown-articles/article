import AuthForm from './AuthForm';
import Chat from './components/Chat';
import { useAuthState } from './useAuth';

export default function App() {
  const { authData, storeSession, clearAuth } = useAuthState();

  if (authData) {
    return <Chat session={authData} onLogout={clearAuth} />;
  }

  return <AuthForm onSuccess={storeSession} />;
}
