// Helpers specifically for bookmark route tests
export const bookmarkBaseNonce = Buffer.alloc(24, 1).toString('base64')
export const bookmarkBaseCiphertext = Buffer.from(
  'encrypted-bookmark-content'
).toString('base64')
export const bookmarkBaseNonceWrap = Buffer.alloc(24, 2).toString('base64')
export const bookmarkBaseDekWrapped = Buffer.alloc(32, 3).toString('base64')

export const calculateBookmarkSize = (
  nonce: string,
  ciphertext: string,
  nonceWrap: string,
  dekWrapped: string
) =>
  Buffer.from(nonce, 'base64').length +
  Buffer.from(ciphertext, 'base64').length +
  Buffer.from(nonceWrap, 'base64').length +
  Buffer.from(dekWrapped, 'base64').length

export const generateHeaders = (
  token: string,
  extra: Record<string, string> = {}
) => ({
  headers: {
    Authorization: `Bearer ${token}`,
    ...extra
  }
})

type OverrideOptions = {
  skipSizeRecalc?: boolean
} & Record<string, unknown>

export const makeBookmarkCreatePayload = (
  itemId = `bm_${Math.random().toString(36).slice(2, 8)}`,
  overrides: OverrideOptions = {}
) => {
  const { skipSizeRecalc, ...rest } = overrides

  const payload: any = {
    item_id: itemId,
    nonce_content: bookmarkBaseNonce,
    ciphertext_content: bookmarkBaseCiphertext,
    nonce_wrap: bookmarkBaseNonceWrap,
    dek_wrapped: bookmarkBaseDekWrapped,
    created_at: Date.now(),
    updated_at: Date.now(),
    ...rest
  }

  if (!skipSizeRecalc) {
    try {
      payload.size = calculateBookmarkSize(
        payload.nonce_content,
        payload.ciphertext_content,
        payload.nonce_wrap,
        payload.dek_wrapped
      )
    } catch {
      payload.size = calculateBookmarkSize(
        bookmarkBaseNonce,
        bookmarkBaseCiphertext,
        bookmarkBaseNonceWrap,
        bookmarkBaseDekWrapped
      )
    }
  }

  payload.size ??= calculateBookmarkSize(
    bookmarkBaseNonce,
    bookmarkBaseCiphertext,
    bookmarkBaseNonceWrap,
    bookmarkBaseDekWrapped
  )

  return payload
}

export const makeBookmarkUpdatePayload = (
  version: number,
  overrides: OverrideOptions = {}
) => {
  const { skipSizeRecalc, ...rest } = overrides

  const payload: any = {
    version,
    nonce_content: bookmarkBaseNonce,
    ciphertext_content: bookmarkBaseCiphertext,
    nonce_wrap: bookmarkBaseNonceWrap,
    dek_wrapped: bookmarkBaseDekWrapped,
    updated_at: Date.now(),
    ...rest
  }

  if (!skipSizeRecalc) {
    try {
      payload.size = calculateBookmarkSize(
        payload.nonce_content,
        payload.ciphertext_content,
        payload.nonce_wrap,
        payload.dek_wrapped
      )
    } catch {
      payload.size = calculateBookmarkSize(
        bookmarkBaseNonce,
        bookmarkBaseCiphertext,
        bookmarkBaseNonceWrap,
        bookmarkBaseDekWrapped
      )
    }
  }

  payload.size ??= calculateBookmarkSize(
    bookmarkBaseNonce,
    bookmarkBaseCiphertext,
    bookmarkBaseNonceWrap,
    bookmarkBaseDekWrapped
  )

  return payload
}
