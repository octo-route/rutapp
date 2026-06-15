import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { translateError } from '@/lib/errorTranslator';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Check if the URL hash contains an authentication error (like expired token)
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1)); // Remove the '#'
      const errorCode = params.get('error_code');
      const errorDesc = params.get('error_description');
      if (errorCode || errorDesc) {
        if (errorCode === 'otp_expired') {
          setErrorMsg('El enlace de recuperación ha expirado o ya fue utilizado. Por favor, solicita uno nuevo desde la página de inicio de sesión.');
        } else {
          setErrorMsg(errorDesc ? decodeURIComponent(errorDesc.replace(/\+/g, ' ')) : 'El enlace de recuperación es inválido.');
        }
        return;
      }
    }

    // Check for recovery event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Contraseña actualizada correctamente');
      navigate('/dashboard');
    } catch (err: any) {
      const t = translateError(err);
      toast.error(t.title, { description: t.suggestion });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm bg-card border border-border rounded p-6">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-primary">OctoApp</h1>
          <p className="text-xs text-muted-foreground mt-1">Nueva contraseña</p>
        </div>
        {errorMsg ? (
          <div className="space-y-4">
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive text-center">
              {errorMsg}
            </div>
            <button
              onClick={() => navigate('/login')}
              className="btn-odoo-primary w-full justify-center"
            >
              Volver al inicio de sesión
            </button>
          </div>
        ) : !ready ? (
          <p className="text-center text-sm text-muted-foreground">Verificando enlace...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="label-odoo label-required">Nueva contraseña</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} className="input-odoo pr-10" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-odoo-primary w-full justify-center" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
