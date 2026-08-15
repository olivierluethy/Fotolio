import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setToken, getToken } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    try {
      const data = await api.get('/auth/me');
      setUser(data.user);
      setSite(data.site);
      return true;
    } catch {
      setUser(null);
      setSite(null);
      return false;
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (getToken()) {
        await loadMe();
      } else {
        // Try silently refreshing via the httpOnly cookie (returning visitor).
        try {
          const data = await api.raw('POST', '/auth/refresh', { auth: false });
          if (data.ok) {
            const json = await data.json();
            setToken(json.access_token);
            await loadMe();
          }
        } catch {
          /* not signed in */
        }
      }
      setLoading(false);
    })();
  }, [loadMe]);

  const afterAuth = async (data) => {
    setToken(data.access_token);
    setUser(data.user);
    await loadMe();
  };

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password }, { auth: false });
    await afterAuth(data);
  };

  const register = async (name, email, password) => {
    const data = await api.post('/auth/register', { name, email, password }, { auth: false });
    await afterAuth(data);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      /* ignore */
    }
    setToken(null);
    setUser(null);
    setSite(null);
  };

  return (
    <AuthContext.Provider value={{ user, site, setSite, loading, login, register, logout, refreshMe: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
