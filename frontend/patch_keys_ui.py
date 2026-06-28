import os

file_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/frontend/src/OmniApp.jsx"
with open(file_path, 'r') as f:
    content = f.read()

# Replace the emoji with proper badge
content = content.replace(
    "<span title='API Key presente nel Vault'>🟠</span>",
    "<span className='badge badge-long' style={{ marginLeft: '0.5rem' }}>SECURE</span>"
)

with open(file_path, 'w') as f:
    f.write(content)
print("OmniApp patched for badge SECURE")
