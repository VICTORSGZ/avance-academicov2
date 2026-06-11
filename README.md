# Avance Académico

Esta versión mantiene el Excel como archivo editable y evita problemas de lectura local del navegador.

## Flujo de uso

1. Edita `data/malla_base.xlsx`.
2. Guarda y cierra el Excel.
3. Ejecuta `convertir_excel.bat`.
4. Se genera automáticamente `data/malla_base.js`.
5. Abre `index.html` o refresca la página.


## Columnas que debe mantener el Excel

En la hoja `Malla` no cambies los nombres de estas columnas:

- Codigo
- Nombre
- Semestre
- Creditos
- Area
- Periodicidad
- Prerequisitos
- EstadoInicial

## Estados válidos

En `EstadoInicial` usa:

- aprobado
- inscrito
- pendiente
- bloqueado

## Prerrequisitos

En `Prerequisitos` escribe códigos separados por coma:

```text
TEC301,DAT301
```

## Requisito para el conversor

El archivo `convertir_excel.bat` usa PowerShell y Microsoft Excel instalado en Windows para leer el `.xlsx`.

Si editas el Excel, guarda y cierra el archivo antes de ejecutar el BAT.
