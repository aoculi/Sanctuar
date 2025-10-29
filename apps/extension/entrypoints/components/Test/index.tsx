import reactLogo from '@/assets/react.svg';
import { useState } from 'react';
import styles from './styles.module.css';
import wxtLogo from '/wxt.svg';

export default function Test() {
    const [count, setCount] = useState(0);

    return (
        <div className={styles.component}>
            <div>
                <a href="https://wxt.dev" target="_blank">
                    <img src={wxtLogo} className={styles.logo} alt="WXT logo" />
                </a>
                <a href="https://react.dev" target="_blank">
                    <img src={reactLogo} className={styles.logoReact} alt="React logo" />
                </a>
            </div>
            <h1>WXT + React</h1>
            <div className={styles.card}>
                <button onClick={() => setCount((count) => count + 1)}>
                    count is {count}
                </button>
                <p>
                    Edit <code>src/App.tsx</code> and save to test HMR
                </p>
            </div>
            <p className={styles.readTheDocs}>
                Click on the WXT and React logos to learn more
            </p>
        </div>
    );
}

