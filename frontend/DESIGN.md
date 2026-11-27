# Diseño de la interfaz

La interfaz permite buscar una propiedad, contactar a su agente y gestionar el proceso de visita.
Esta revisión mejora la presentación existente y conserva sus rutas, permisos, formularios y reglas.

## Identidad y jerarquía

- Barlow, servida por el propio frontend. Tinta y cabecera índigo; amarillo para la acción principal y
  la sección activa; magenta para identificar la zona. Los tokens vigentes están en `src/index.css`.
- Un título principal por pantalla, seguido de una descripción breve de la tarea. Los filtros y las
  acciones de página se separan del contenido de los registros.
- Los estados mantienen texto visible y sus tonos semánticos. Un color nunca es la única señal.
- En cada registro se agrupan la identidad, el estado, los datos y las acciones. Los botones
  secundarios conservan su contorno para que sea evidente dónde se puede actuar.

## Navegación

- La cabecera conserva inicio, accesos según rol, campana de avisos y menú de usuario.
- El panel de agente conserva sus cuatro secciones; los iconos acompañan al texto. En celular se
  distribuyen en dos columnas para que todas sean visibles.
- En las páginas privadas del cliente, `AccountNavigation` muestra visitas, consultas, favoritos y
  avisos. El menú de usuario y los accesos anteriores se mantienen.
- Al cambiar de pantalla se vuelve al inicio; modificar filtros o pasos no fuerza el desplazamiento,
  y Atrás conserva el comportamiento del navegador.
- El primer enlace permite saltar al contenido con el teclado. Se conserva el foco visible en los
  controles y el orden del documento sigue el orden de lectura.

## Propiedades del agente

- Cada propiedad muestra su portada, zona, estado, título, tipo, operación, características y precio.
- La portada se obtiene del resumen que ya devuelve Listing. No se pide el detalle de cada propiedad.
  Solo las portadas privadas de la página visible se descargan con autorización y se almacenan en la
  caché de la sesión. Las públicas conservan carga diferida.
- Las imágenes privadas se muestran como `data:` mediante la conversión compartida del editor;
  no se cambian CSP ni permisos. Si una imagen no existe o falla, aparece «Sin foto» y las acciones
  continúan disponibles.
- Editar o completar es un acceso explícito. Publicar, pausar, reservar, liberar una reserva, vender
  y alquilar conservan sus condiciones y confirmaciones. Para propiedades cerradas el acceso se
  presenta como consulta, porque no son editables.
- En escritorio ancho, foto, datos y acciones se alinean en columnas. En celular, las acciones pasan
  debajo y pueden ocupar varias líneas. Los títulos largos se envuelven, sin ocultar controles.

## Ficha pública de la propiedad

- En escritorio, la galería ocupa la columna principal. Precio, operación, consultas, visitas y
  favoritos se agrupan en una columna lateral. Los datos, descripción ampliable y mapa quedan
  debajo de las fotos, con títulos propios y sin mezclar texto descriptivo con los formularios.
- En celular se lee galería, precio/contacto y datos completos. Ambos paneles de contacto tienen
  superficie de botón; visita es la acción principal. Comparten el mismo grupo desplegable.
- La columna de contacto deja de ser fija al abrir un formulario para que todos sus campos y
  mensajes sean alcanzables. La consulta enviada ofrece acceso a «Mis consultas».
- Se mantienen todos los datos, fotos, mapa, permisos y estados de publicación existentes.

## Otras pantallas

- Consultas: contacto, propiedad, fecha y estado; el detalle y la respuesta siguen abriéndose en la fila.
- Visitas: agenda, horario, contacto y estado; aceptar, proponer, rechazar, cancelar y completar siguen
  usando los flujos existentes.
- Oportunidades: contacto, propiedad y estado separados de agregar nota, ver notas y cerrar.
- Avisos: título por tipo, mensaje íntegro, fecha y estado de lectura. Se mantienen los destinos,
  marcar como leído, borrar y el anuncio emergente. Los tipos nuevos tienen un título genérico.
- Usuarios: datos y roles separados de activar, desactivar y modificar roles; se mantienen las
  protecciones de la cuenta propia y la advertencia sobre renovación del token.
- Ingreso y registro: mismos campos y validaciones, con formularios y acciones consistentes. En
  celular se evita dejar espacio vacío antes del formulario.
- Catálogo, ficha y editor: se mantienen mapa real, filtros, orden, paginación, favoritos, galería,
  consultas, propuestas de visita, pasos del editor, vista previa y orden/portada de fotos.

## Archivos y verificación

- `src/management.css` contiene el diseño compartido de gestión, navegación personal y adaptación.
  Sustituye las reglas antiguas de `skin.css` que comprimían el contenido junto a las acciones.
- Los tokens `--owner-cover-width` (160 px), `--owner-cover-mobile-width` (96 px) y
  `--owner-actions-width` (320 px) definen las columnas de la lista del agente.
- Pruebas: suite completa del frontend y casos de portada pública, privada, fallida y conservación
  de acciones. La prueba del anuncio distingue el contenido de la lista del aviso emergente.
- Revisión visual: escritorio de 1440 px y celular de 390 px; comprobar imágenes, títulos largos,
  filtros, estados, formularios abiertos, navegación y ausencia de desplazamiento horizontal.
- Se conserva el respeto a `prefers-reduced-motion`. No se agregan fuentes externas, dependencias
  visuales ni recursos ficticios a las publicaciones.
