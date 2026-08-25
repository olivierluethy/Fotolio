import { useEffect, useId, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { Input } from './ui/Controls';
import { Icon } from './ui/Icon';
import { Spinner } from './ui/Button';

/**
 * Location field with geocoding: type to get place suggestions (debounced +
 * abortable so keystrokes don't flood the proxy), and a "current location"
 * button that reverse-geocodes the browser position into a readable name.
 *
 * `onChange(text)` updates the free-text value; `onPick({label, lat, lng})`
 * fires when a suggestion or the current location is chosen (so callers can also
 * persist coordinates). Fully keyboard-navigable (↑/↓/Enter/Esc).
 */
export function LocationInput({ value, onChange, onPick, placeholder }) {
  const toast = useToast();
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  const abortRef = useRef(null);
  const timerRef = useRef(null);
  const blurRef = useRef(null);
  const boxRef = useRef(null);
  const listId = useId();

  // Debounced, abortable search. A new query cancels the in-flight one.
  useEffect(() => () => { clearTimeout(timerRef.current); clearTimeout(blurRef.current); abortRef.current?.abort(); }, []);

  const runSearch = (q) => {
    clearTimeout(timerRef.current);
    if (!q || q.trim().length < 3) {
      abortRef.current?.abort();
      setResults([]); setLoading(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const { results: r } = await api.get(`/geocode?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        if (ctrl.signal.aborted) return;
        setResults(r || []); setActive(-1); setOpen(true);
      } catch (err) {
        if (err?.name === 'AbortError') return; // superseded — ignore
        setResults([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 300);
  };

  const handleType = (v) => { onChange(v); runSearch(v); };

  const choose = (r) => {
    if (!r) return;
    onChange(r.label);
    onPick?.(r);
    setOpen(false); setResults([]); setActive(-1);
  };

  const onKeyDown = (ev) => {
    if (!open || results.length === 0) {
      if (ev.key === 'ArrowDown' && value?.trim().length >= 3) runSearch(value);
      return;
    }
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setActive((i) => (i + 1) % results.length); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); setActive((i) => (i <= 0 ? results.length - 1 : i - 1)); }
    else if (ev.key === 'Enter') { if (active >= 0) { ev.preventDefault(); choose(results[active]); } }
    else if (ev.key === 'Escape') { ev.preventDefault(); setOpen(false); }
  };

  const useCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      toast.error("This browser can't share your location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lng } = pos.coords;
          const { result } = await api.get(`/geocode/reverse?lat=${lat}&lng=${lng}`);
          if (result?.label) {
            onChange(result.label);
            onPick?.({ label: result.label, lat: result.lat, lng: result.lng });
            setOpen(false);
          } else {
            // Fall back to raw coordinates so the field is still usable offline.
            onChange(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
            onPick?.({ label: '', lat, lng });
            toast.info("Couldn't find a place name — used your coordinates.");
          }
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Couldn't look up your location.");
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        const msg = err.code === err.PERMISSION_DENIED ? 'Location permission was denied.'
          : err.code === err.TIMEOUT ? 'Location request timed out.'
          : 'Your location is unavailable right now.';
        toast.error(msg);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  return (
    <div className="relative" ref={boxRef}
      onBlur={() => { blurRef.current = setTimeout(() => setOpen(false), 120); }}
      onFocus={() => clearTimeout(blurRef.current)}>
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Input
            value={value || ''}
            onChange={(e) => handleType(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => { if (results.length) setOpen(true); }}
            placeholder={placeholder || 'Start typing a place…'}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            autoComplete="off"
          />
          {loading && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint"><Spinner size={14} /></span>}
        </div>
        <button type="button" onClick={useCurrentLocation} disabled={locating} title="Use my current location"
          aria-label="Use my current location"
          className="flex-none w-9 h-9 grid place-items-center rounded-md border text-ink-muted hover:text-ink hover:bg-surface-2 disabled:opacity-50">
          {locating ? <Spinner size={15} /> : <Icon name="mapPin" size={16} />}
        </button>
      </div>

      {open && results.length > 0 && (
        <ul id={listId} role="listbox"
          className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-md border bg-surface shadow-lg py-1">
          {results.map((r, i) => (
            <li
              key={`${r.label}-${i}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); choose(r); }}
              onMouseEnter={() => setActive(i)}
              className={`px-3 py-2 text-sm cursor-pointer flex items-start gap-2 ${i === active ? 'bg-surface-2 text-ink' : 'text-ink-muted'}`}
            >
              <Icon name="mapPin" size={14} className="mt-0.5 flex-none text-ink-faint" />
              <span className="min-w-0 truncate">{r.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
