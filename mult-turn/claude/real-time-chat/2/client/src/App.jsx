import AuthForm from './AuthForm';
import Chat from './components/Chat';
import { useSession } from './useAuth';

export default function App() {
  const { userSession, persistSession, signOut } = useSession();

  if (userSession) {
    return <Chat session={userSession} onLogout={signOut} />;
  }

  return <AuthForm onSuccess={persistSession} />;
}
