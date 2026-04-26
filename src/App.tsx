import { useEffect } from 'react';
import AppRouter from './routes/AppRouter';
import { supabase } from './lib/supabaseClient';
import { useAuthStore } from './store/useAuthStore';
import posthog from 'posthog-js';
import './store/useThemeStore';

const App: React.FC = () => {
  const { setUser, setSession, setInitialized } = useAuthStore();

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? '' });
        setSession(session);
        posthog.identify(session.user.id, {
          email: session.user.email,
          created_at: session.user.created_at,
        });
      } else {
        setUser(null);
        setSession(null);
      }

      setInitialized(true);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser({ id: session.user.id, email: session.user.email ?? '' });
          setSession(session);
          posthog.identify(session.user.id, {
            email: session.user.email,
            created_at: session.user.created_at,
          });
        } else {
          setUser(null);
          setSession(null);
          posthog.reset();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [setUser, setSession, setInitialized]);

  return <AppRouter />;
};

export default App;