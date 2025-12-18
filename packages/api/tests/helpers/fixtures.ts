// Test fixtures - common test data
export const testUsers = {
  alice: {
    login: 'alice@example.com',
    password: 'AliceSecure123!'
  },
  bob: {
    login: 'bob@example.com',
    password: 'BobSecure456!'
  },
  charlie: {
    login: 'charlie@example.com',
    password: 'CharlieSecure789!'
  }
}

export const testWmk = {
  valid:
    'VGhpcyBpcyBhIDI0IGJ5dGUgbm9uY2UhVGhpcyBpcyAzMiBieXRlcyBvZiBjaXBoZXJ0ZXh0ISE=', // 24 byte nonce + 32 byte ciphertext
  tooShort: 'c2hvcnQ=', // Too short (< 40 bytes)
  invalidBase64: 'not-valid-base64!!!'
}

export const invalidCredentials = {
  shortLogin: {
    login: 'ab',
    password: 'ValidPass123!'
  },
  longLogin: {
    login: 'a'.repeat(256),
    password: 'ValidPass123!'
  },
  shortPassword: {
    login: 'test@example.com',
    password: 'short'
  },
  longPassword: {
    login: 'test@example.com',
    password: 'a'.repeat(129)
  },
  missingLogin: {
    password: 'ValidPass123!'
  },
  missingPassword: {
    login: 'test@example.com'
  }
}
