import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Controls';
import { OAuthButtons } from '../components/OAuthButtons';
import { ApiError } from '../lib/api';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: 'demo@fotolio.app', password: 'password' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    try {
      await login(form.email, form.password);
      navigate('/app');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.errors || {});
        toast.error(err.message);
      } else {
        toast.error('Could not sign in. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="font-display font-bold text-2xl text-ink">Welcome back</h1>
      <p className="text-ink-muted text-sm mt-1.5">Sign in to manage your portfolio.</p>

      <div className="mt-6">
        <OAuthButtons />
      </div>
      <div className="flex items-center gap-3 my-5 text-[12px] text-ink-faint">
        <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Field label="Email" error={errors.email}>
          <Input type="email" autoComplete="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} />
        </Field>
        <Field label="Password" error={errors.password}>
          <Input type="password" autoComplete="current-password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} error={errors.password} />
        </Field>
        <Button type="submit" loading={loading} className="w-full btn-lg">Sign in</Button>
      </form>

      <p className="text-sm text-ink-muted mt-6 text-center">
        New to Fotolio? <Link to="/register" className="link font-medium">Create an account</Link>
      </p>
      <p className="text-[12px] text-ink-faint mt-4 text-center">
        Demo account is pre-filled — just press Sign in.
      </p>
    </AuthLayout>
  );
}
