type ServiceWorkerRegistrar = Pick<ServiceWorkerContainer, "register">;

type RegisterServiceWorkerOptions = {
  enabled?: boolean;
  serviceWorker?: ServiceWorkerRegistrar;
};

export function registerServiceWorker({
  enabled = import.meta.env.PROD,
  serviceWorker = navigator.serviceWorker
}: RegisterServiceWorkerOptions = {}): Promise<ServiceWorkerRegistration | undefined> {
  if (!enabled || !serviceWorker) {
    return Promise.resolve(undefined);
  }

  return serviceWorker.register("/service-worker.js", {
    scope: "/"
  });
}
