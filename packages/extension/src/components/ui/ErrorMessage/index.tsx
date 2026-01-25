import { AlertCircle, Info, Settings } from 'lucide-react'

import { openExtensionPage } from '@/lib/tabs'

import styles from './styles.module.css'

type ErrorMessageProps = {
  message: string
  type?: 'network' | 'api-config' | 'general'
}

export default function ErrorMessage({ message, type }: ErrorMessageProps) {
  const isConfigIssue = type === 'network' || type === 'api-config'

  const handleOpenSettings = () => {
    openExtensionPage('settings')
  }

  const getMessage = () => {
    if (type === 'api-config') {
      return 'Please configure your API URL in settings to connect.'
    }
    if (type === 'network') {
      return 'Unable to reach the server. Please verify your API URL in settings.'
    }
    return message
  }

  const Icon = isConfigIssue ? Info : AlertCircle

  return (
    <div className={styles.root}>
      <div className={styles.icon}>
        <Icon size={16} />
      </div>
      <div className={styles.content}>
        <span>{getMessage()}</span>
        {isConfigIssue && (
          <button
            type="button"
            onClick={handleOpenSettings}
            className={styles.settingsLink}
          >
            <Settings size={12} />
            Open Settings
          </button>
        )}
      </div>
    </div>
  )
}
