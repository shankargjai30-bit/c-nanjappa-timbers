import os
from PIL import Image

src_dir = r'C:\Users\Jaishankar.G\.gemini\antigravity\brain\2d3c3f6d-d07a-460d-b7e4-0655a622150c'
dest_dir = r'c:\Users\Jaishankar.G\Desktop\c nanjappa timnbers\src\assets\dashboard-backgrounds'

os.makedirs(dest_dir, exist_ok=True)

files = {
    'employees_bg': 'employees-bg.webp',
    'attendance_bg': 'attendance-bg.webp',
    'biometrics_bg': 'biometrics-bg.webp',
    'payroll_bg': 'payroll-bg.webp',
    'ot_bg': 'ot-bg.webp',
    'reports_bg': 'reports-bg.webp'
}

for filename in os.listdir(src_dir):
    for key, new_name in files.items():
        if filename.startswith(key) and filename.endswith('.png'):
            img_path = os.path.join(src_dir, filename)
            dest_path = os.path.join(dest_dir, new_name)
            img = Image.open(img_path)
            img.save(dest_path, 'WEBP')
            print(f'Converted {filename} to {new_name}')
