import React from 'react'

import styles from './styles.module.css'

interface TextareaProps extends Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'size'
> {
  size?: 'sm' | 'md' | 'lg'
  error?: string
  children?: React.ReactNode
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ size = 'md', error, className, children, ...props }, ref) => {
    const textareaClassName = `${styles.textarea} ${styles[size]} ${
      error ? styles.error : ''
    } ${children ? styles.withContent : ''} ${className || ''}`.trim()

    return (
      <div className={styles.component}>
        {children && <div className={styles.content}>{children}</div>}
        <textarea ref={ref} {...props} className={textareaClassName} />
        {error && <span className={styles.fieldError}>{error}</span>}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

export default Textarea
