# wger

[wger](https://wger.de) es un registro libre de entrenamiento y de peso (AGPL-3.0), usado en wger.de o autoalojado. Esta integración trae su cuenta wger a Gladys: su peso y su tendencia, sus sesiones de la semana, las calorías registradas hoy, disparadores de escena y una acción de escena que **añade un pesaje en wger**: una báscula conectada ya integrada en Gladys puede así alimentar wger.

Probada contra un servidor wger real en Docker (wger 2.8, la versión de wger.de): lectura, adición de pesajes, errores. Sin relación con el proyecto wger.

## Requisitos

- Una cuenta wger, en [wger.de](https://wger.de) o en su propio servidor (se recomienda wger 2.6 o posterior; probada con la 2.8).
- Su **clave API**: en wger, abra el menú de usuario, luego **Clave API**, y genere una clave (en wger.de: <https://wger.de/es/user/api-key>).
- Gladys Assistant 5.1 o posterior.

## Configuración

En Gladys, abra **Integraciones → wger**, y luego la configuración:

- **Dirección de wger**: `https://wger.de`, o la dirección de su propio servidor (p. ej. `http://192.168.1.20:8000`). Se acepta una dirección copiada del navegador.
- **Clave API**: la clave generada en wger. Gladys la guarda como un secreto y nunca se escribe en los registros.
- **Intervalo de actualización**: 15 minutos, 30 minutos (por defecto) o 1 hora. Un pesaje añadido desde una escena se lee al momento.
- **Idioma de los nombres**: idioma de los nombres de funciones (fijados al añadir el dispositivo) y de los textos enviados a las escenas.

El botón **Probar la conexión** lee wger al momento e indica la cuenta conectada.

## El dispositivo

Un dispositivo por cuenta, `wger <nombre de usuario>`, propuesto en la pestaña **Descubrir**. Añádalo para obtener sus funciones:

| Función                                               | Valor                                                       |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| Peso (kg) / Peso (lb)                                 | el último pesaje, en la unidad de su perfil wger            |
| Variación en 7 días (kg) / Variación en 7 días (lb)   | el último pesaje menos el de hace 7 días, o anterior        |
| Variación en 30 días (kg) / Variación en 30 días (lb) | lo mismo en 30 días                                         |
| IMC                                                   | cuando su altura está indicada en su perfil wger            |
| Días desde el último pesaje                           | 0 el mismo día                                              |
| Sesiones esta semana                                  | las sesiones desde el lunes                                 |
| Días desde la última sesión                           | 0 el mismo día                                              |
| Última sesión                                         | su día, y luego sus notas o su rutina                       |
| Calorías de hoy (kcal)                                | los alimentos registrados hoy, si tiene un plan nutricional |

Solo se da una variación si wger tiene un pesaje bastante antiguo (como mucho el doble del periodo antes): con un pesaje de hace un mes, no hay «variación en 7 días».

Datos de salud: las funciones **no guardan historial por defecto** (puede activarlo función por función en Gladys), y ningún valor se escribe nunca en los registros.

## Widget

El widget **Peso y sesiones** muestra el peso y su variación en 7 días, las sesiones de la semana, el día de la última sesión, las calorías del día (frente al objetivo del plan nutricional), la curva del peso de los últimos 30 días y un botón **Actualizar**. Funciona incluso antes de añadir el dispositivo.

## Disparadores de escena

- **Nuevo pesaje**: aparece en wger un pesaje más reciente que el último conocido (app, web, báscula, o la acción de escena de abajo). Información transmitida: peso, unidad, variación en 7 días, IMC, fecha.
- **Sesión registrada**: aparece en wger una sesión más reciente que la última conocida. Información transmitida: notas o rutina, fecha, duración, sesiones esta semana.
- **Ninguna sesión desde hace tiempo**: ninguna sesión desde hace 2, 3, 5, 7 o 14 días (a elegir). Una vez por umbral, hasta la siguiente sesión. Información transmitida: días desde la última sesión, su fecha.

Los disparadores se detectan en la siguiente lectura de wger (vea el intervalo de actualización). La primera lectura de una cuenta no anuncia nada: solo lo que ocurre después.

## Acciones de escena

- **Añadir un pesaje**: añade un peso en wger. El peso es un número (`79,8` o `79.8`) o un valor de la escena, por ejemplo el peso de una báscula conectada (insértelo con `{{`). La fecha es ahora, salvo que la indique (`2026-10-22` o `22/10/2026`). Se rechaza, con una línea en los registros de Gladys: lo que no es un número, un peso fuera de 20–350 kg (44–770 lb), una fecha en el futuro y, salvo que desmarque la casilla, un peso a más de un 10 % del último pesaje de los 30 últimos días (otra persona, o el gato, en la báscula). El mismo peso el mismo día no se añade dos veces. Resultados: añadido, peso, unidad, fecha, variación en 7 días, mensaje.
- **Leer el resumen de la semana**: lee wger y pasa el peso, sus variaciones, el IMC, las sesiones de la semana, la última sesión, las calorías del día y una frase lista a las acciones siguientes.

## Ejemplos de escenas

- **La báscula alimenta wger**: disparador «el valor de un dispositivo cambia» sobre el peso de su báscula conectada → acción **Añadir un pesaje** con ese valor → un mensaje con el peso y su variación en 7 días, dados por la acción.
- **Un empujón desde el sofá**: disparador **Ninguna sesión desde hace tiempo** (3 días) → mensaje «Ninguna sesión desde hace 3 días, ¿una carrera corta?».
- **El resumen del domingo por la noche**: disparador «cada domingo a las 20:00» → **Leer el resumen de la semana** → mensaje con su frase: «Peso 79,8 kg (-0,7 kg en 7 días) · 2 sesiones esta semana, la última jue, 22/10».

## Solución de problemas

- **Acceso denegado: compruebe la clave API**: genere una nueva clave en wger y péguela de nuevo (con o sin la palabra «Token»).
- **wger no responde**: compruebe la dirección y que Gladys alcanza el servidor (para un wger autoalojado, el puerto, p. ej. `:8000` o `:80`).
- **La dirección redirige**: indique la dirección `https://` de su servidor.
- **Sin calorías**: la función solo existe con un plan nutricional en wger; son las calorías de los alimentos registrados hoy.
- **Se rechazó un pesaje**: el motivo está en los registros de Gladys; desmarque el control del 10 % si su peso ha cambiado realmente tanto.
- Problemas e ideas: <https://github.com/guim31/gladys-wger/issues>.

## Límites

- Una cuenta wger por integración. Para dos personas, hacen falta dos cuentas wger (y la instalación de la integración sigue una de ellas).
- La unidad de peso es la de su perfil wger; cambiarla añade nuevas funciones en la otra unidad (actualice el dispositivo desde la pestaña Descubrir).
- Solo lectura, salvo los pesajes añadidos por la acción de escena: no se modifica ninguna rutina ni ningún plan nutricional.
- Las calorías del día necesitan una petición por alimento registrado la primera vez (después se guardan): un diario cargado se lee en unos segundos.
- El texto «Última sesión» da las notas de la sesión, o el nombre de su rutina.
