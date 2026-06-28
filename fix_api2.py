with open("backend/api.py", "r") as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if '@app.get("/api/status")' in line and i > 400:
        skip = True
    if skip and 'pos_dict = {}' in line and i > 400:
        skip = False
        continue
    if not skip:
        new_lines.append(line)

with open("backend/api.py", "w") as f:
    f.writelines(new_lines)
