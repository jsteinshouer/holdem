export function registerServiceWorker({ enabled = import.meta.env.PROD, serviceWorker = navigator.serviceWorker } = {}) {
    if (!enabled || !serviceWorker) {
        return Promise.resolve(undefined);
    }
    return serviceWorker.register("/service-worker.js", {
        scope: "/"
    });
}
