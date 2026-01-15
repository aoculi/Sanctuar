import { Globe, Link, Lock, Shield, Terminal } from 'lucide-react'

import Text from '@/components/ui/Text'

import styles from './styles.module.css'

const GITHUB_URL = 'https://github.com/aoculi/lockmark'

export default function Help() {
  return (
    <div className={styles.component}>
      <div className={styles.content}>
        <div className={styles.container}>
          <div className={styles.header}>
            <Text size='5' weight='medium'>
              Getting Started with LockMark
            </Text>
            <Text size='2' color='light'>
              A secure, end-to-end encrypted bookmark manager
            </Text>
          </div>

          <div className={styles.section}>
            <div className={styles.step}>
              <div className={styles.stepNumber}>
                <Terminal size={16} />
              </div>
              <div className={styles.stepContent}>
                <Text size='3' weight='medium'>
                  1. Start the API Server
                </Text>
                <Text size='2' color='light'>
                  Run the LockMark API on your local machine (default:{' '}
                  <code>http://127.0.0.1:3500</code>)
                </Text>
              </div>
            </div>

            <div className={styles.step}>
              <div className={styles.stepNumber}>
                <Globe size={16} />
              </div>
              <div className={styles.stepContent}>
                <Text size='3' weight='medium'>
                  2. Configure API URL
                </Text>
                <Text size='2' color='light'>
                  Open <strong>Settings</strong> and set your API Base URL if
                  different from the default
                </Text>
              </div>
            </div>

            <div className={styles.step}>
              <div className={styles.stepNumber}>
                <Shield size={16} />
              </div>
              <div className={styles.stepContent}>
                <Text size='3' weight='medium'>
                  3. Create an Account
                </Text>
                <Text size='2' color='light'>
                  Register a new account. Your master key is derived from your
                  password using Argon2id
                </Text>
              </div>
            </div>

            <div className={styles.step}>
              <div className={styles.stepNumber}>
                <Lock size={16} />
              </div>
              <div className={styles.stepContent}>
                <Text size='3' weight='medium'>
                  4. Start Adding Bookmarks
                </Text>
                <Text size='2' color='light'>
                  All bookmarks are encrypted client-side before being stored.
                  Your data stays private
                </Text>
              </div>
            </div>
          </div>

          <div className={styles.features}>
            <Text size='4' weight='medium'>
              Security Features
            </Text>
            <div className={styles.featureList}>
              <div className={styles.feature}>
                <Text size='2' color='light'>
                  <strong>Client-side encryption</strong> - Argon2id KDF +
                  XChaCha20-Poly1305 + HKDF-SHA-256
                </Text>
              </div>
              <div className={styles.feature}>
                <Text size='2' color='light'>
                  <strong>Zero-knowledge server</strong> - Only ciphertext,
                  nonces, and password hashes stored
                </Text>
              </div>
              <div className={styles.feature}>
                <Text size='2' color='light'>
                  <strong>Optimistic concurrency</strong> - ETags prevent sync
                  conflicts
                </Text>
              </div>
            </div>
          </div>

          <a
            href={GITHUB_URL}
            target='_blank'
            rel='noopener noreferrer'
            className={styles.githubLink}
          >
            <Link size={18} />
            <Text size='2' weight='medium'>
              View on GitHub
            </Text>
          </a>
        </div>
      </div>
    </div>
  )
}
