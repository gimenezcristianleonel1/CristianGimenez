// Recepción de un aviso Web Push (funciona con la app CERRADA). El backend
// manda { title, body, url }. Muestra la notificación del sistema.
self.addEventListener('push', (event) => {
  let data = { title: 'Ganader-IA', body: 'Tenés un aviso pendiente', url: '/tasks' };
  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch (e) {
    /* payload no-JSON: usamos los valores por defecto */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/ICONO.jpeg',
      badge: '/ICONO.jpeg',
      data: { url: data.url || '/tasks' },
    }),
  );
});

// Manejo del click en los avisos de tareas: enfoca (o abre) la app en /tasks.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if ('focus' in client) {
          try {
            await client.navigate(target);
          } catch {
            /* algunos navegadores no permiten navigate; se enfoca igual */
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })(),
  );
});
