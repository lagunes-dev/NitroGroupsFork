# Ola 1 de usabilidad: quitar el ruido que los críticos marcaron

Documento ODD: Specs → Tasks → Log. Rama `feat/membership-ux`. Verificación visual con Playwright por el orquestador.

## Specs

- **S1 (estados).** "Los tres estados se ven idénticos (mismo gris, mismo peso, sin etiqueta ni icono)" (Camila). En "Mis pedidos" cada estado (pendiente, aceptada, rechazada, cancelada) se distingue de un vistazo por texto y color, no solo por la palabra; la lista se ordena por fecha del evento y la columna de precio es igual en todas las filas.
- **S2 (prioridad).** "Cuando abrí mi panel lo primero que vi fue un historial, no lo que tengo que contestar hoy" (Mónica). En el panel del grupo, lo pendiente va arriba con su conteo y el historial queda plegado abajo.
- **S3 (filtros honestos).** "La barra muestra Guadalajara y 20000 pero el resultado se calculó sin ciudad ni presupuesto" (Camila). Un campo sin valor se lee como vacío ("sin filtro"), nunca como un valor aplicado.
- **S4 (home sin decoración falsa).** "Chips de fecha y grupos falsos que ni son clicables" (Camila). La portada no muestra fechas ni grupos de ejemplo que parezcan datos reales.
- **S5 (no ofrecer lo imposible).** "Hasta me ofrece contratarnos a nosotros mismos" (Miguel). Quien ya es miembro de un grupo no ve "Pedir una fecha" ni "Pedir unirse" en ese grupo.
- **S6 (hilo ordenado).** "La secuencia no es cronológica, y en un chat eso confunde" (Mónica). Los mensajes se leen en orden de envío.
- **S7 (un idioma).** "Corporate, Wedding, Birthday en inglés" (los cuatro). Los tipos de evento y los estados que pinta la interfaz se muestran en español.

## Tasks

- [ ] T1 (S1, S2, S6, S7) Pedidos: estados legibles, orden por fecha, precio consistente, bandeja de pendientes arriba, hilo ordenado y etiquetas de tipo de evento en español.
- [ ] T2 (S3, S4, S5) Filtros honestos, portada sin datos falsos y sin acciones imposibles para miembros.
- [ ] T3 (S1-S7) Verificación con Playwright en las cuatro cuentas, escritorio y celular.

## Log

- L1 (usuario, verbatim): "si" — aprueba arrancar la Ola 1 del plan de mejoras.
- Base: informes de los cuatro críticos (Camila 3/10, Mateo 2/10, Mónica 3/10, Miguel 1/10) en esta misma sesión.
