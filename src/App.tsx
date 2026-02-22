import { useEffect } from 'react';
import AppRouter from './routes/AppRouter';
import { supabase } from './lib/supabaseClient';
import { useAuthStore } from './store/useAuthStore';
import './store/useThemeStore'; // Initialise theme store early (applies class to <html>)

const App: React.FC = () => {
  const { setUser, setSession, setInitialized } = useAuthStore();

  useEffect(() => {
    // Check for existing session on mount
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email ?? '',
        });
        setSession(session);
      } else {
        setUser(null);
        setSession(null);
      }

      setInitialized(true);
    };

    initAuth();

    // Listen for auth state changes (sign in, sign out, token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email ?? '',
          });
          setSession(session);
        } else {
          setUser(null);
          setSession(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, setSession, setInitialized]);

  return <AppRouter />;
};

export default App;
