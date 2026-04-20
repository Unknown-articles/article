import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { AuthForm } from './components/AuthForm.jsx';
import { Chat } from './components/Chat.jsx';

function AppContent() {
  const { user } = useAuth();
  return user ? <Chat /> : <AuthForm />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
