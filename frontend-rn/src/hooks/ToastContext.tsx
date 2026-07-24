import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const TOAST_BG: Record<ToastType, string> = {
  success: 'rgba(59,130,246,0.18)',
  error: 'rgba(244,63,94,0.18)',
  info: 'rgba(59,130,246,0.18)',
};

const TOAST_INDICATOR: Record<ToastType, string> = {
  success: '#60a5fa',
  error: '#fb7185',
  info: '#60a5fa',
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: TOAST_BG[toast.type], opacity, transform: [{ translateY }] },
      ]}
    >
      <View style={[styles.indicator, { backgroundColor: TOAST_INDICATOR[toast.type] }]} />
      <Text style={styles.message} numberOfLines={1}>
        {toast.message}
      </Text>
      <Pressable onPress={() => onRemove(toast.id)} hitSlop={12} style={styles.dismiss}>
        <Text style={styles.dismissText}>✕</Text>
      </Pressable>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const insets = useSafeAreaInsets();
  const lastMessageRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const short = message.replace(/\s+/g, ' ').trim().slice(0, 64);
    const now = Date.now();
    // Dedupe identical spam within 4s (websocket floods).
    if (
      lastMessageRef.current.text === short &&
      now - lastMessageRef.current.at < 4000
    ) {
      return;
    }
    lastMessageRef.current = { text: short, at: now };

    const id = generateId();
    // Keep at most one toast on screen.
    setToasts([{ id, message: short, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2200);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View style={[styles.container, { bottom: insets.bottom + 72 }]} pointerEvents="box-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={remove} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    left: 16,
    zIndex: 200,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  indicator: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  dismiss: {
    padding: 4,
  },
  dismissText: {
    fontSize: 13,
    color: '#64748b',
  },
});
