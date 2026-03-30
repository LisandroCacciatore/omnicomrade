# assets/css

Esta carpeta no contiene un build local de Tailwind.

## Estrategia oficial
- Tailwind se carga exclusivamente vía CDN en los HTML del proyecto.
- No existe `assets/css/tailwind.css`.
- No se usa `assets/css/input.css` ni scripts de compilación en `package.json`.

## Uso esperado
- Si se necesitan estilos adicionales, deben agregarse como CSS manual específico o revisarse explícitamente la estrategia del proyecto antes de introducir un pipeline local.
