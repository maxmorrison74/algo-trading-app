import google.generativeai as genai
import sys

key = sys.argv[1]
genai.configure(api_key=key)
for m in genai.list_models():
    if "generateContent" in m.supported_generation_methods:
        print(m.name)
