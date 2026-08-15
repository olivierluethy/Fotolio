import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Controls';
import { OAuthButtons } from '../components/OAuthButtons';
import { ApiError } from '../lib/api';

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    try {
      await register(form.name, form.email, form.password);
      toast.success('Account created. Welcome to Fotolio!');
      navigate('/app');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.errors || {});
        toast.error(err.message);
      } else {
        toast.error('Could not create your account. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="font-display font-bold text-2xl text-ink">Create your studio</h1>
      <p className="text-ink-muted text-sm mt-1.5">Upload, optimise, and publish your own photo site.</p>

      <div className="mt-6">
        <OAuthButtons />
      </div>
      <div className="flex items-center gap-3 my-5 text-[12px] text-ink-faint">
        <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" error={errors.name}>
          <Input autoComplete="name" placeholder="Your name or studio" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input type="email" autoComplete="email" placeholder="you@example.com" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} />
        </Field>
        <Field label="Password" error={errors.password} hint="At least 8 characters.">
          <Input type="password" autoComplete="new-password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} error={errors.password} />
        </Field>
        <Button type="submit" loading={loading} className="w-full btn-lg">Create account</Button>
      </form>

      <p className="text-sm text-ink-muted mt-6 text-center">
        Already have an account? <Link to="/login" className="link font-medium">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
