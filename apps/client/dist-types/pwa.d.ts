type ServiceWorkerRegistrar = Pick<ServiceWorkerContainer, "register">;
type RegisterServiceWorkerOptions = {
    enabled?: boolean;
    serviceWorker?: ServiceWorkerRegistrar;
};
export declare function registerServiceWorker({ enabled, serviceWorker }?: RegisterServiceWorkerOptions): Promise<ServiceWorkerRegistration | undefined>;
export {};
//# sourceMappingURL=pwa.d.ts.map