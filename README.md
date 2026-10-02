# Dory · versión web

App web instalable para iPhone. El proyecto nativo Swift permanece en `../DondeLoDeje`. El nombre visible es Dory; el identificador interno del almacén y de las copias se conserva para no perder registros existentes.

## Qué hace

- Guarda dónde dejaste cualquier objeto, por voz o por teclado.
- Busca el último lugar registrado, por voz o por teclado, y puede leer la respuesta.
- Conserva el historial en IndexedDB del navegador, sin cuenta ni servidor de datos.
- Exporta una copia JSON e importa registros sin borrar los existentes.
- Tiene icono de inicio y archivos para poder abrirse sin conexión después de la primera carga. El dictado puede requerir conexión y depende de Safari, de los permisos de micrófono y de tener Siri activado.

## Probar en un Mac

Desde esta carpeta, ejecuta `python3 -m http.server 8000` y abre `http://localhost:8000` en el navegador. La app se sirve como archivos estáticos: no hace falta instalar dependencias.

## Instalar en el iPhone

1. Abre <https://sergiosaba12.github.io/donde-lo-deje-web/> en **Safari** del iPhone.
2. Pulsa **Compartir → Añadir a pantalla de inicio** y abre el nuevo icono.
3. Pulsa **Hablar** y acepta los permisos de voz. Si el dictado no funciona en ese dispositivo, el botón `+` permite guardar y buscar escribiendo.

La app está publicada gratuitamente en GitHub Pages. No necesita Apple Developer Program ni caduca a los siete días. Los datos quedan separados en cada iPhone y navegador: no se sincronizan. El almacenamiento del navegador no garantiza conservación indefinida; usa **Exportar copia** periódicamente. Para pasar registros a otro móvil, exporta el JSON e impórtalo allí.

## Estructura

- `core.js`: interpretación de frases y selección del registro más reciente.
- `repository.js`: almacenamiento local tras una interfaz pequeña que se puede reemplazar por una API más adelante.
- `app.js`: interfaz, reconocimiento y síntesis de voz, importación y exportación.
- `service-worker.js`: recursos de la app disponibles sin conexión.
