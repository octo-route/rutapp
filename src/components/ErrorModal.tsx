import {
  useState,
  useCallback,
  useEffect,
  createContext,
  useContext,
  ReactNode,
} from "react";
import {
  AlertTriangle,
  Wifi,
  ShieldAlert,
  Server,
  Database,
  Lock,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { translateError, getRawMessage } from "@/lib/errorTranslator";
import { subscribeErrorModal } from "@/lib/globalError";

interface ErrorState {
  title: string;
  message: string;
  suggestion: string;
  icon: string;
  raw: string;
  open: boolean;
}

interface ErrorContextType {
  showError: (error: unknown) => void;
}

const ErrorContext = createContext<ErrorContextType>({ showError: () => {} });

export const useErrorModal = () => useContext(ErrorContext);

const iconMap: Record<string, React.ReactNode> = {
  network: <Wifi className="h-7 w-7" />,
  auth: <Lock className="h-7 w-7" />,
  server: <Server className="h-7 w-7" />,
  data: <Database className="h-7 w-7" />,
  permission: <ShieldAlert className="h-7 w-7" />,
  generic: <AlertTriangle className="h-7 w-7" />,
};

export function ErrorModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ErrorState | null>(null);
  const [banner, setBanner] = useState<ErrorState | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const showError = useCallback((error: unknown) => {
    const translated = translateError(error);
    const raw = getRawMessage(error);

    const nextState = { ...translated, raw, open: true };

    if (translated.icon === "network") {
      setBanner(nextState);
      return;
    }

    setState(nextState);
    setShowRaw(false);
  }, []);

  useEffect(() => subscribeErrorModal(showError), [showError]);

  const close = () => setState(null);
  const closeBanner = () => setBanner(null);

  return (
    <ErrorContext.Provider value={{ showError }}>
      {children}

      {banner?.open && (
        <div className="fixed top-4 left-1/2 z-[9999] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg">
          <div className="flex items-start gap-3">
            <Wifi className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">
                Sin conexión
              </p>
              <p className="text-xs text-amber-800">
                Trabajando con datos locales. Se sincronizará cuando vuelva la
                conexión.
              </p>
            </div>
            <button
              onClick={closeBanner}
              className="rounded-md p-1 text-amber-700 hover:bg-amber-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {state?.open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={close}
          />

          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 fade-in duration-200 overflow-hidden">
            <button
              onClick={close}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors z-10"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="pt-8 pb-4 flex justify-center">
              <div
                className={`rounded-full p-4 ${
                  state.icon === "auth"
                    ? "bg-blue-50 text-blue-500"
                    : state.icon === "server"
                      ? "bg-red-50 text-red-500"
                      : state.icon === "data"
                        ? "bg-violet-50 text-violet-500"
                        : state.icon === "permission"
                          ? "bg-orange-50 text-orange-500"
                          : "bg-slate-100 text-slate-500"
                }`}
              >
                {iconMap[state.icon] || iconMap.generic}
              </div>
            </div>

            <div className="px-6 pb-2 text-center">
              <h2 className="text-lg font-bold text-slate-900 mb-2">
                {state.title}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                {state.message}
              </p>
              <div className="bg-slate-50 rounded-xl px-4 py-3 mb-4">
                <p className="text-xs text-slate-500 font-medium flex items-start gap-2">
                  <span className="text-base leading-none mt-px">💡</span>
                  <span>{state.suggestion}</span>
                </p>
              </div>
            </div>

            <div className="px-6 pb-4">
              <button
                onClick={() => setShowRaw(!showRaw)}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-500 transition-colors mx-auto"
              >
                Detalles técnicos
                {showRaw ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
              {showRaw && (
                <div className="mt-2 bg-slate-900 rounded-lg px-3 py-2 max-h-24 overflow-y-auto">
                  <code className="text-[10px] text-slate-300 break-all font-mono leading-relaxed">
                    {state.raw}
                  </code>
                </div>
              )}
            </div>

            <div className="px-6 pb-6">
              <button
                onClick={close}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl py-3 text-sm transition-colors active:scale-[0.98]"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </ErrorContext.Provider>
  );
}
