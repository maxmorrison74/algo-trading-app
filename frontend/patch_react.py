import os

file_path = "/Users/maxmorrison/.gemini/antigravity/scratch/algo-trading-app/frontend/src/OmniApp.jsx"
with open(file_path, 'r') as f:
    content = f.read()

# Make all toFixed safe
content = content.replace("p.unrealized_pl.toFixed(2)", "Number(p.unrealized_pl || 0).toFixed(2)")
content = content.replace("p.unrealized_plpc.toFixed(2)", "Number(p.unrealized_plpc || 0).toFixed(2)")
content = content.replace("status.portfolio_value || 0).toFixed(2)", "Number(status.portfolio_value || 0).toFixed(2)")
content = content.replace("status.cash || 0).toFixed(2)", "Number(status.cash || 0).toFixed(2)")
content = content.replace("status.profit || 0).toFixed(2)", "Number(status.profit || 0).toFixed(2)")
content = content.replace("status.win_rate || 0).toFixed(1)", "Number(status.win_rate || 0).toFixed(1)")

# Add Error Boundary
error_boundary = """
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <div style={{color: 'red', padding: '2rem'}}>
        <h2>React Crash!</h2>
        <pre>{this.state.error.toString()}</pre>
      </div>;
    }
    return this.props.children;
  }
}
"""

if "class ErrorBoundary" not in content:
    content = content.replace("function OmniApp() {", error_boundary + "\nfunction OmniApp() {")

# Wrap return in ErrorBoundary
content = content.replace("return (\n    <div className=\"omni-app\">", "return (\n  <ErrorBoundary>\n    <div className=\"omni-app\">")
content = content.replace("    </div>\n  );\n}", "    </div>\n  </ErrorBoundary>\n  );\n}")

with open(file_path, 'w') as f:
    f.write(content)

print("Patched OmniApp for safety.")
