import os
import time
import pandas as pd
from playwright.sync_api import sync_playwright
from datetime import datetime

# Configuration
EDIPRO_EMAIL = "cachozas@gmail.com"
EDIPRO_PASS = "Facu2026$"
BASE_URL = "https://lareservademitrinhue.edipro.app"
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))

def download_latest_from_edipro(page, section_url, filename_prefix):
    """Navigates to a section, clicks Excel export, and waits for it in /descargas"""
    print(f"--- Sincronizando {filename_prefix} ---")
    page.goto(section_url)
    
    # Click Excel Export Button
    print("Solicitando exportación a Excel...")
    excel_btn = page.wait_for_selector("a:has-text('Excel'), button:has-text('Excel')")
    excel_btn.click()
    
    # In the modal, click 'Descargar Excel' (which actually requests it)
    try:
        request_btn = page.wait_for_selector("button:has-text('Descargar Excel'), input[value='Descargar Excel']", timeout=5000)
        request_btn.click()
    except:
        print("Botón de solicitud directa no encontrado o ya solicitado.")

    time.sleep(5) # Give it time to generate
    
    print("Esperando archivo en sección de Descargas...")
    page.goto(f"{BASE_URL}/descargas")
    
    # Find the most recent download link
    # The first 'Descargar' link in the table should be the most recent
    download_link = page.wait_for_selector("a:has-text('Descargar')", timeout=30000)
    
    target_path = os.path.join(DATA_DIR, f"{filename_prefix}_raw.xlsx")
    
    with page.expect_download() as download_info:
        download_link.click()
    
    download = download_info.value
    download.save_as(target_path)
    print(f"Archivo crudo guardado en: {target_path}")
    return target_path

def process_egresos(filepath):
    print("Procesando Egresos...")
    df = pd.read_excel(filepath)
    # Mapping columns (EDIPRO columns might vary, we normalize)
    # Typical: Fecha, Monto, Fondo, Sub Fondo, Proveedor
    # Ensure they match the dashboard's expected semicolon CSV
    df.to_csv(os.path.join(DATA_DIR, "egresos.csv"), sep=";", index=False, encoding="utf-8-sig")
    print("egresos.csv actualizado.")

def process_ingresos(filepath):
    print("Procesando Ingresos...")
    df = pd.read_excel(filepath)
    # Map to dash format: #Ingreso,Unidad,Propietario,Monto,Fecha
    df.to_csv(os.path.join(DATA_DIR, "ingresos.csv"), index=False, encoding="utf-8-sig")
    print("ingresos.csv actualizado.")

def main():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False) # Headed for visibility
        context = browser.new_context()
        page = context.new_page()

        print("Iniciando sesión en EDIPRO...")
        page.goto(f"{BASE_URL}/users/sign_in")
        page.fill("input[type='email'], input[type='text']", EDIPRO_EMAIL)
        page.fill("input[type='password']", EDIPRO_PASS)
        page.click("button[type='submit'], input[type='submit']")
        page.wait_for_url(f"{BASE_URL}/")
        print("Login exitoso.")

        try:
            # Sync Egresos
            egresos_file = download_latest_from_edipro(page, f"{BASE_URL}/egresos", "egresos")
            process_egresos(egresos_file)

            # Sync Ingresos
            ingresos_file = download_latest_from_edipro(page, f"{BASE_URL}/ingresos", "ingresos")
            process_ingresos(ingresos_file)

            # Cleanup raw files
            os.remove(egresos_file)
            os.remove(ingresos_file)

            print("\n¡Sincronización completada con éxito!")
        except Exception as e:
            print(f"ERROR DURANTE LA SINCRONIZACIÓN: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    main()
