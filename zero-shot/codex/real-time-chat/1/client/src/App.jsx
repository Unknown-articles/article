import { useState } from "react";
import { AuthForm } from "./components/AuthForm";
import { Chat } from "./components/Chat";
import {
  clearStoredSession,
  loadStoredSession,
  storeSession,
} from "./session";

export default function App() {
  const [session, setSession] = useState(() => loadStoredSession());

  function handleAuthenticated(nextSession) {
    storeSession(nextSession);
    setSession(nextSession);
  }

  function handleLogout() {
    clearStoredSession();
    setSession(null);
  }

  if (!session) {
    return <AuthForm onAuthenticated={handleAuthenticated} />;
  }

  return <Chat session={session} onLogout={handleLogout} />;
}
