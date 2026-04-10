import { useState } from 'react'

type ParseReceiptResult = {
  success: boolean
  data?: Record<string, any>
  needs_review?: boolean
  image_hash?: string
  method?: string
  cached?: boolean
}

export function useReceiptParser(baseCandidates: string[]) {
  const [processing, setProcessing] = useState(false)

  const parseReceipt = async (file: File, authToken: string): Promise<ParseReceiptResult> => {
    if (!file) {
      throw new Error('No file provided')
    }

    const formData = new FormData()
    formData.append('file', file)

    let lastError: unknown = null
    setProcessing(true)

    try {
      for (const base of baseCandidates) {
        try {
          const response = await fetch(`${base}/parse-receipt`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${authToken}` },
            body: formData,
          })

          if (response.ok) {
            return await response.json()
          }

          const errorBody = await response.json().catch(() => ({}))
          const detail = errorBody?.detail || 'Parsing failed'
          throw new Error(detail)
        } catch (error) {
          lastError = error
        }
      }
    } finally {
      setProcessing(false)
    }

    throw lastError || new Error('All OCR endpoints failed')
  }

  return { parseReceipt, processing }
}
