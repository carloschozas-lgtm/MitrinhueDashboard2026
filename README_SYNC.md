# Sincronizador de Datos EDIPRO -> Dashboard

Este script permite actualizar automáticamente los datos de tu dashboard directamente desde la plataforma EDIPRO.

## Requisitos
- Python 3.8+
- Bibliotecas: `playwright`, `pandas`, `openpyxl`

Para instalar los requisitos, ejecuta:
```bash
pip install playwright pandas openpyxl
playwright install chromium
```

## Cómo usar el sincronizador
1. Abre una terminal en la carpeta `Dashboard2026`.
2. Ejecuta el script:
```bash
python scripts/sync_edipro.py
```
3. El script hará lo siguiente:
   - Se conectará a EDIPRO (usando las credenciales de `cachozas@gmail.com`).
   - Solicitará la exportación de **Ingresos** y **Egresos**.
   - Descargará los archivos Excel generados.
   - Actualizará automáticamente `data/ingresos.csv` y `data/egresos.csv` con el formato correcto.

4. **Publicar Cambios:** Una vez actualizado localmente, recuerda hacer un "Push" a GitHub (o pedirme que lo haga) para que los vecinos vean los datos nuevos en la web.

---
**Nota:** El script abre una ventana del navegador automáticamente para realizar el proceso. No cierres la ventana hasta que veas el mensaje "Sincronización completada con éxito" en la terminal.
