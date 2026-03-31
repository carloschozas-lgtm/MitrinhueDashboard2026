import os
import time
import pandas as pd
from playwright.sync_api import sync_playwright
from datetime import datetime

# Configuration
EDIPRO_EMAIL = "cachozas@gmail.com"
EDIPRO_PASS = "Facu2026$"
BASE_URL = "https://lareservademitrinhue.edipro.app"
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))

def download_latest_from_edipro(page, section_url, filename_prefix, row_keyword):
    """Busca y espera que el archivo de EDIPRO aparezca como Listo y extrae su URL de S3 directamente"""
    print(f"--- Sincronizando {filename_prefix} ---")
    page.goto(section_url)
    
    target_path = os.path.join(DATA_DIR, f"{filename_prefix}_raw.xlsx")
    
    print("Solicitando exportación a Excel...")
    try:
        excel_btn = page.wait_for_selector("a:has-text('Excel'), button:has-text('Excel')", timeout=15000)
        excel_btn.click()
        
        request_btn = page.wait_for_selector("button:has-text('Descargar Excel'), input[value='Descargar Excel']", timeout=5000)
        request_btn.click()
    except Exception:
        print("Botón modal no encontrado o ya solicitado previo.")

    page.wait_for_timeout(3000)
    
    print("Navegando a /descargas para iniciar Polling Seguro...")
    page.goto(f"{BASE_URL}/descargas")
    
    descarga_lista = False
    fila_locator = page.locator(f"table tbody tr:has-text('{row_keyword}')").first
    
    for intento in range(1, 15):
        print(f"Polling intento {intento}/15...")
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(2000)
        
        try:
            if fila_locator.locator("span.badge.bg-success:has-text('Listo')").is_visible():
                print("¡Generación Completada! Estado Listo detectado.")
                descarga_lista = True
                break
        except Exception:
            pass
            
        if not descarga_lista:
            print("Archivo aún procesándose. Esperando 15 segundos...")
            page.wait_for_timeout(15000)

    if not descarga_lista:
        raise Exception(f"Timeout Polling S3: Archivo {filename_prefix} no completó su generación.")
        
    print("Extrayendo URL remota de Amazon S3...")
    try:
        enlace_s3 = fila_locator.locator("a[download]").first.get_attribute("href")
        print(f"URL interceptada: {enlace_s3[:60]}...")
        
        import urllib.request
        urllib.request.urlretrieve(enlace_s3, target_path)
        print(f"Archivo binario S3 descargado exitosamente vía urllib.")
        return target_path
    except Exception as e:
        raise Exception(f"Fallo crítico al extraer o descargar la URL de S3: {e}")

def process_egresos(filepath):
    print("Procesando Egresos...")
    try:
        df_temp = pd.read_excel(filepath, header=None)
        header_idx = 0
        for i, row in df_temp.iterrows():
            row_str = " ".join(str(x).lower() for x in row.dropna())
            if 'monto' in row_str and 'fecha' in row_str:
                header_idx = i
                break
        df = pd.read_excel(filepath, skiprows=header_idx)
            
        rename_map = {}
        for col in df.columns:
            c_low = str(col).lower()
            if 'monto' in c_low: rename_map[col] = 'Monto'
            elif 'fecha' in c_low: rename_map[col] = 'Fecha'
            elif 'sub' in c_low: rename_map[col] = 'Sub Fondo'
            elif 'nulo' in c_low: rename_map[col] = 'Nulo'
            
        df.rename(columns=rename_map, inplace=True)
        
        # Limpieza de Moneda
        if 'Monto' in df.columns:
            df['Monto'] = df['Monto'].astype(str).str.replace(r'[^\d-]', '', regex=True)
            df['Monto'] = pd.to_numeric(df['Monto'], errors='coerce').fillna(0)
            
        df.to_csv(os.path.join(DATA_DIR, "egresos.csv"), sep=";", index=False, encoding="utf-8-sig")
        print("egresos.csv actualizado.")
    except Exception as e:
        print(f"Error procesando egresos: {e}")

def process_ingresos(filepath):
    print("Procesando Ingresos...")
    try:
        df_temp = pd.read_excel(filepath, header=None)
        header_idx = 0
        for i, row in df_temp.iterrows():
            row_str = " ".join(str(x).lower() for x in row.dropna())
            if 'monto' in row_str and ('unidad' in row_str or 'lote' in row_str):
                header_idx = i
                break
        df = pd.read_excel(filepath, skiprows=header_idx)
            
        rename_map = {}
        for col in df.columns:
            c_low = str(col).lower()
            if 'unidad' in c_low or 'lote' in c_low: rename_map[col] = 'Unidad'
            elif 'monto' in c_low: rename_map[col] = 'Monto'
            elif 'fecha' in c_low: rename_map[col] = 'Fecha Ingreso'
            elif 'fondo' in c_low: rename_map[col] = 'Fondos'
            elif 'nulo' in c_low: rename_map[col] = 'Nulo'
            
        df.rename(columns=rename_map, inplace=True)
        
        # Limpieza de Moneda
        if 'Monto' in df.columns:
            df['Monto'] = df['Monto'].astype(str).str.replace(r'[^\d-]', '', regex=True)
            df['Monto'] = pd.to_numeric(df['Monto'], errors='coerce').fillna(0)
            
        df.to_csv(os.path.join(DATA_DIR, "ingresos.csv"), sep=";", index=False, encoding="utf-8-sig")
        print("ingresos.csv actualizado.")
    except Exception as e:
        print(f"Error procesando ingresos: {e}")

def process_deuda(filepath):
    print("Procesando Deuda...")
    try:
        df_temp = pd.read_excel(filepath, header=None)
        header_idx = 0
        for i, row in df_temp.iterrows():
            row_str = " ".join(str(x).lower() for x in row.dropna())
            if 'unidad' in row_str and ('total' in row_str or 'saldo' in row_str):
                header_idx = i
                break
        df = pd.read_excel(filepath, skiprows=header_idx)
            
        rename_map = {}
        for col in df.columns:
            c_low = str(col).lower()
            if 'unidad' in c_low or 'lote' in c_low: rename_map[col] = 'Unidad'
            elif ('total' in c_low or 'saldo' in c_low) and '%' not in c_low and 'sobre' not in c_low: rename_map[col] = 'Deuda Total Incluye Intereses'
            elif 'meses' in c_low: rename_map[col] = 'Meses deuda'
            elif 'ingreso' in c_low or 'pago' in c_low: rename_map[col] = 'Último ingreso'

        df.rename(columns=rename_map, inplace=True)
        
        # Limpieza de Moneda
        if 'Deuda Total Incluye Intereses' in df.columns:
            df['Deuda Total Incluye Intereses'] = df['Deuda Total Incluye Intereses'].astype(str).str.replace(r'[^\d-]', '', regex=True)
            df['Deuda Total Incluye Intereses'] = pd.to_numeric(df['Deuda Total Incluye Intereses'], errors='coerce').fillna(0)
            
        df.to_csv(os.path.join(DATA_DIR, "deuda.csv"), sep=";", index=False, encoding="utf-8-sig")
        print("deuda.csv actualizado.")
    except Exception as e:
        print(f"Error procesando deuda: {e}")

def main():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

    with sync_playwright() as p:
        print("Lanzando Chrome local (HEADED)...")
        try:
            # Using the local chrome path found in the project
            browser = p.chromium.launch(executable_path=CHROME_PATH, headless=False)
        except Exception as be:
            print(f"ERROR AL LANZAR NAVEGADOR: {be}.")
            return
            
        context = browser.new_context()
        page = context.new_page()

        print("Iniciando sesión en EDIPRO...")
        # Actual login URL confirmed by subagent
        page.goto(f"{BASE_URL}/auth/users/sign_in", timeout=60000, wait_until="domcontentloaded")
        print(f"URL actual: {page.url}")
        
        # Exact selectors from subagent inspection
        page.wait_for_selector("#user_login", timeout=30000)
        
        # Clear and fill email
        page.locator("#user_login").fill("")
        page.type("#user_login", EDIPRO_EMAIL, delay=100)
        
        # Clear and fill password
        page.locator("#password-field").fill("")
        page.type("#password-field", EDIPRO_PASS, delay=100)
        
        time.sleep(2)
        # Click the submit button
        page.click(".btn-login, input[type='submit']")
        page.wait_for_url(f"{BASE_URL}/", timeout=60000)
        print("Login exitoso.")

        try:
            # Sync Egresos
            egresos_file = download_latest_from_edipro(page, f"{BASE_URL}/egresos", "egresos", "Egresos")
            process_egresos(egresos_file)

            # Sync Ingresos
            ingresos_file = download_latest_from_edipro(page, f"{BASE_URL}/ingresos", "ingresos", "Ingresos")
            process_ingresos(ingresos_file)

            # Sync Deuda (morosidad)
            deuda_file = download_latest_from_edipro(page, f"{BASE_URL}/deudas", "deuda", "Deuda")
            process_deuda(deuda_file)

            # Cleanup raw files
            if os.path.exists(egresos_file): os.remove(egresos_file)
            if os.path.exists(ingresos_file): os.remove(ingresos_file)
            if os.path.exists(deuda_file): os.remove(deuda_file)

            print("\n¡Sincronización completada con éxito!")
        except Exception as e:
            print(f"ERROR DURANTE LA SINCRONIZACIÓN: {e}")
            import traceback
            traceback.print_exc()
            try:
                debug_path = os.path.join(os.path.dirname(__file__), "debug_error.png")
                page.screenshot(path=debug_path)
                print(f"Captura de pantalla de error guardada en {debug_path}")
            except:
                pass
        finally:
            browser.close()

if __name__ == "__main__":
    main()
