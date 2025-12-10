import React from 'react'

import styles from './styles.module.css'

function Text({
  size = '2',
  weight = 'regular',
  as = 'div',
  color = 'inherit',
  children,
  style,
  className
}: {
  size?: '1' | '2' | '3' | '4' | '5' | '6'
  weight?: 'light' | 'regular' | 'medium' | 'bold'
  as?: 'label' | 'p' | 'div' | 'h1' | 'span'
  color?: 'inherit' | 'light' | 'primary' | 'white'
  style?: React.CSSProperties
  children: React.ReactNode
  className?: string
}) {
  const newClassName = `${styles.text} ${styles['size-' + size]} ${
    styles['weight-' + weight]
  } ${styles['color-' + color]}${className ? ' ' + className : ''}`

  if (as === 'label') {
    return (
      <label className={newClassName} style={style}>
        {children}
      </label>
    )
  }
  if (as === 'p') {
    return (
      <p className={newClassName} style={style}>
        {children}
      </p>
    )
  }
  if (as === 'h1') {
    return (
      <h1 className={newClassName} style={style}>
        {children}
      </h1>
    )
  }
  if (as === 'span') {
    return (
      <span className={newClassName} style={style}>
        {children}
      </span>
    )
  }
  return (
    <div className={newClassName} style={style}>
      {children}
    </div>
  )
}

export default Text
