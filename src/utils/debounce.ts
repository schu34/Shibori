/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: number | null = null;

    return function (this: any, ...args: Parameters<T>) {
        const context = this;

        if (timeout !== null) {
            window.clearTimeout(timeout);
        }

        timeout = window.setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
} 