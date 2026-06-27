import os

file_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/frontend/src/OmniApp.jsx"
with open(file_path, 'r') as f:
    content = f.read()

# I want to add a check for localStorage when setting up the initial state for isAuthenticated
old_auth_state = "const [isAuthenticated, setIsAuthenticated] = useState(false);"

new_auth_state = """
  const checkAuthMemory = () => {
    const authTime = localStorage.getItem('omni_auth_time');
    if (authTime) {
      const elapsed = Date.now() - parseInt(authTime, 10);
      if (elapsed < 24 * 60 * 60 * 1000) {
        return true;
      }
    }
    return false;
  };
  const [isAuthenticated, setIsAuthenticated] = useState(checkAuthMemory());
"""
if "const checkAuthMemory" not in content:
    content = content.replace(old_auth_state, new_auth_state)

# I want to save to localStorage upon successful login
old_handle_login = """      if (res.ok && data.status === 'success') {
        setIsAuthenticated(true);
        setLoginError('');"""

new_handle_login = """      if (res.ok && data.status === 'success') {
        setIsAuthenticated(true);
        localStorage.setItem('omni_auth_time', Date.now().toString());
        setLoginError('');"""

if "localStorage.setItem('omni_auth_time'" not in content:
    content = content.replace(old_handle_login, new_handle_login)

with open(file_path, 'w') as f:
    f.write(content)

print("Auth Memory added.")
