import pandas as pd
import os

input_file = r'c:\CARLOS PC\ANTIGRAVITY\LA RESERVA DE MITRINHUE\DEUDA GGCC.xlsx'
output_dir = r'c:\CARLOS PC\ANTIGRAVITY\LA RESERVA DE MITRINHUE\Dashboard2026\data'
output_file = os.path.join(output_dir, 'deuda.csv')

if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# Read the excel file
try:
    df = pd.read_excel(input_file)
    # Basic cleaning if necessary
    df.to_csv(output_file, index=False, encoding='utf-8-sig')
    print(f"Conversion successful: {output_file}")
except Exception as e:
    print(f"Error during conversion: {e}")
