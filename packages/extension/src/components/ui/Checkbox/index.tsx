import React from 'react'

import styles from './styles.module.css'

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string | React.ReactNode
}

export const Checkbox = (props: CheckboxProps) => {
  return (
    <label className={styles.labelContainer}>
      <div className={styles.checkboxContainer}>
        <input type='checkbox' {...props} className={styles.checkbox} />
        <span className={styles.checkmark} />
      </div>
      {props.label && typeof props.label === 'string' ? (
        <span>{props.label}</span>
      ) : (
        props.label
      )}
    </label>
  )
}
