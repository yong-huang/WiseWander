import { useState, useEffect } from 'react'

interface TranslatePanelProps {
  translatedText: string
  originalText: string
  /** Text staged elsewhere (e.g. right-click "AI translate selection") */
  seedText?: string | null
  /** Called after the seed text has been consumed into the input */
  onConsumeSeed?: () => void
  isTranslating: boolean
  onTranslate: (text: string, targetLang: string) => void
  onBack?: () => void
}

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ar', name: 'Arabic' },
]

export function TranslatePanel({
  translatedText,
  originalText,
  seedText,
  onConsumeSeed,
  isTranslating,
  onTranslate,
  onBack,
}: TranslatePanelProps): React.ReactElement {
  const [inputText, setInputText] = useState('')
  const [targetLang, setTargetLang] = useState('zh')

  // Prefill from a staged selection, then release it
  useEffect(() => {
    if (seedText) {
      setInputText(seedText)
      onConsumeSeed?.()
    }
  }, [seedText, onConsumeSeed])

  const handleTranslate = (): void => {
    const text = inputText.trim()
    if (!text || isTranslating) return
    onTranslate(text, targetLang)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header with optional back button */}
      {onBack && (
        <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
          <button
            onClick={onBack}
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ← Tools
          </button>
          <span className="text-xs text-gray-300 dark:text-gray-600">|</span>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Translate</span>
        </div>
      )}

      <div className="flex flex-1 flex-col p-3">
      {/* Source text input */}
      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-gray-500">Text to translate</label>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Enter or paste text to translate..."
          rows={4}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500
            dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500
            resize-none"
        />
      </div>

      {/* Target language + translate button */}
      <div className="mb-3 flex gap-2">
        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm
            dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
        <button
          onClick={handleTranslate}
          disabled={isTranslating || !inputText.trim()}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white
            hover:bg-blue-700 disabled:opacity-50"
        >
          {isTranslating ? 'Translating...' : 'Translate'}
        </button>
      </div>

      {/* Translation result */}
      {translatedText && (
        <div className="flex-1 overflow-y-auto">
          {originalText && (
            <div className="mb-2">
              <label className="mb-1 block text-xs font-medium text-gray-400">Original</label>
              <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                {originalText}
              </div>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">Translation</label>
            <div className="rounded-lg bg-blue-50 p-3 text-sm text-gray-800 dark:bg-blue-950 dark:text-blue-200">
              {translatedText}
            </div>
          </div>
        </div>
      )}

      {!translatedText && !isTranslating && (
        <div className="flex flex-1 flex-col items-center justify-center pt-8 text-center">
          <div className="mb-3 text-4xl opacity-20">🌐</div>
          <p className="text-sm text-gray-400">Enter text above to translate</p>
        </div>
      )}
      </div>
    </div>
  )
}
