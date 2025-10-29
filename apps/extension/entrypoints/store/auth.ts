// In-memory store for sensitive authentication data
// KDF parameters and wrapped master key are stored in memory only

export type KdfParams = {
    algo: string;
    salt: string;
    m: number;
    t: number;
    p: number;
};

export class AuthStore {
    private kdf: KdfParams | null = null;
    private wrappedMk: string | null = null;

    setKdf(kdf: KdfParams | null): void {
        this.kdf = kdf;
    }

    setWrappedMk(wrapped: string | null): void {
        this.wrappedMk = wrapped;
    }

    getKdf(): KdfParams | null {
        return this.kdf;
    }

    getWrappedMk(): string | null {
        return this.wrappedMk;
    }

    clear(): void {
        this.kdf = null;
        this.wrappedMk = null;
    }
}

export const authStore = new AuthStore();
