import os
import sys
import time
import subprocess
import webbrowser

def main():
    print("=" * 60)
    print("      MHT-CET Engineering College Predictor & CAP Portal")
    print("=" * 60)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(base_dir, "backend") if os.path.exists(os.path.join(base_dir, "backend")) else os.path.join(base_dir, "CET_College_Predictor")
    frontend_index = os.path.join(base_dir, "frontend", "index.html") if os.path.exists(os.path.join(base_dir, "frontend", "index.html")) else os.path.join(base_dir, "mhtcet", "public", "index.html")
    frontend_predictor = os.path.join(base_dir, "frontend", "predictor.html") if os.path.exists(os.path.join(base_dir, "frontend", "predictor.html")) else os.path.join(base_dir, "mhtcet", "public", "predictor.html")

    print("\n[+] Starting FastAPI backend on http://127.0.0.1:8000 ...")

    # Check if port 8000 is already active
    import urllib.request
    try:
        urllib.request.urlopen("http://127.0.0.1:8000/api/metadata", timeout=2)
        print("[+] FastAPI backend server is ALREADY running on http://127.0.0.1:8000 !")
        server_process = None
    except Exception:
        try:
            server_process = subprocess.Popen(
                [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000", "--reload"],
                cwd=backend_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )
            time.sleep(2)
            if server_process.poll() is not None:
                print("[-] FastAPI backend failed to start. Logs:")
                print(server_process.stdout.read())
                return
            print("[+] Backend started successfully!")
        except Exception as e:
            print(f"[-] Error launching backend server: {e}")
            return

    target_html = frontend_index if os.path.exists(frontend_index) else frontend_predictor
    print(f"[+] Opening website: file:///{target_html} ...")
    webbrowser.open(f"file:///{target_html}")

    print("\n" + "=" * 60)
    print("MHT-CET Predictor Portal is now LIVE!")
    print("Backend URL: http://127.0.0.1:8000")
    print("Frontend URL: file:///" + target_html.replace("\\", "/"))
    print("To stop the server, press Ctrl+C in this terminal window.")
    print("=" * 60 + "\n")

    if server_process:
        try:
            while True:
                line = server_process.stdout.readline()
                if line:
                    print(line.strip())
                if server_process.poll() is not None:
                    print("[-] Server process ended unexpectedly.")
                    break
        except KeyboardInterrupt:
            print("\n[-] Shutting down predictor server...")
        finally:
            server_process.terminate()
            try:
                server_process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                server_process.kill()
            print("[+] Server stopped.")

if __name__ == "__main__":
    main()
