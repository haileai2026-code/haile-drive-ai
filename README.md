# Haile Drive AI

## TTS Provider Setup
כדי לשנות ספק TTS — שנה את `TTS_PROVIDER` ב-`src/lib/diagnostics/config.ts`:

- `'browser'`    → חינמי, איכות נמוכה (Web Speech API)
- `'elevenlabs'` → דורש `ELEVENLABS_API_KEY` ב-Lovable Secrets (משתמש ב-server function)
- `'azure'`      → דורש `VITE_AZURE_TTS_KEY` + `VITE_AZURE_TTS_REGION`
- `'google'`     → דורש `VITE_GOOGLE_TTS_KEY`

כל המעבר בין הספקים נעשה ע"י שינוי שורה אחת. ראה `getTTSProvider()` ב-`config.ts`.
