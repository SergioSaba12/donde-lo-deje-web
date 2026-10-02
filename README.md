# Dónde lo dejé · versión web

App web instalable para iPhone. El proyecto nativo Swift permanece en `../DondeLoDeje`.

## Qué hace

- Guarda dónde dejaste cualquier objeto, por voz o por teclado.
- Busca el último lugar registrado, por voz o por teclado, y puede leer la respuesta.
- Conserva el historial en IndexedDB del navegador, sin cuenta ni servidor de datos.
- Exporta una copia JSON e importa registros sin borrar los existentes.
- Tiene icono de inicio y archivos para poder abrirse sin conexión después de la primera carga. El dictado puede requerir conexión y depende de Safari, de los permisos de micrófono y de tener Siri activado.

## Probar en un Mac

Desde esta carpeta, ejecuta `python3 -m http.server 8000` y abre `http://localhost:8000` en el navegador. La app se sirve como archivos estáticos: no hace falta instalar dependencias.

## Instalar en el iPhone

1. Publica **el contenido de esta carpeta** en cualquier alojamiento estático con HTTPS. Un archivo local o la dirección `localhost` del Mac no servirá como enlace para el iPhone.
2. Abre el enlace HTTPS en **Safari** del iPhone.
3. Pulsa **Compartir → Añadir a pantalla de inicio** y abre el nuevo icono.
4. Pulsa **Hablar** y acepta los permisos de voz. Si el dictado no funciona en ese dispositivo, el botón `+` permite guardar y buscar escribiendo.

El alojamiento estático puede ser gratuito. La app web no necesita Apple Developer Program ni caduca a los siete días. Los datos quedan separados en cada iPhone y navegador: no se sincronizan. El almacenamiento del navegador no garantiza conservación indefinida; usa **Exportar copia** periódicamente. Para pasar registros a otro móvil, exporta el JSON e impórtalo allí.

## Estructura

- `core.js`: interpretación de frases y selección del registro más reciente.
- `repository.js`: almacenamiento local tras una interfaz pequeña que se puede reemplazar por una API más adelante.
- `app.js`: interfaz, reconocimiento y síntesis de voz, importación y exportación.
- `service-worker.js`: recursos de la app disponibles sin conexión.
