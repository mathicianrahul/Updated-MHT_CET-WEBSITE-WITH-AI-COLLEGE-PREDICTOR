import os
import sys
import time
import subprocess
import webbrowser
import urllib.request

def is_port_active(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=2) as response:
            return True
    except Exception:
        return False

def main():
    print("=" * 60)
    print("      MHT-CET Engineering College Predictor & CAP Portal")
    print("=" * 60)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    fastapi_backend_dir = os.path.join(base_dir, "backend") if os.path.exists(os.path.join(base_dir, "backend")) else os.path.join(base_dir, "CET_College_Predictor")
    node_backend_dir = os.path.join(base_dir, "mhtcet", "backend")

    frontend_index = os.path.join(base_dir, "frontend", "index.html") if os.path.exists(os.path.join(base_dir, "frontend", "index.html")) else os.path.join(base_dir, "mhtcet", "public", "index.html")
    frontend_predictor = os.path.join(base_dir, "frontend", "predictor.html") if os.path.exists(os.path.join(base_dir, "frontend", "predictor.html")) else os.path.join(base_dir, "mhtcet", "public", "predictor.html")

    processes = []

    # 1. Start Node.js Auth Backend (Port 5000)
    if os.path.exists(node_backend_dir):
        if is_port_active("http://127.0.0.1:5000/api/check-auth"):
            print("[+] Node.js Auth server is ALREADY running on http://localhost:5000")
        else:
            print("\n[+] Starting Node.js Auth backend on http://localhost:5000 ...")
            try:
                node_proc = subprocess.Popen(
                    ["node", "server.js"],
                    cwd=node_backend_dir,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
                time.sleep(2.0)
                if node_proc.poll() is None:
                    print("[+] Node.js Auth backend started successfully on http://localhost:5000 !")
                    processes.append(node_proc)
                else:
                    print("[-] Node.js Auth backend failed to start. Running in cloud/offline fallback mode.")
            except Exception as e:
                print(f"[-] Node.js launch skipped: {e}")

    # 2. Start FastAPI Predictor Backend (Port 8000)
    print("\n[+] Starting FastAPI Predictor backend on http://127.0.0.1:8000 ...")
    if is_port_active("http://127.0.0.1:8000/api/metadata"):
        print("[+] FastAPI predictor server is ALREADY running on http://127.0.0.1:8000 !")
    else:
        try:
            fastapi_proc = subprocess.Popen(
                [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000", "--reload"],
                cwd=fastapi_backend_dir,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            time.sleep(2)
            if fastapi_proc.poll() is None:
                print("[+] FastAPI Predictor backend started successfully on http://127.0.0.1:8000 !")
                processes.append(fastapi_proc)
            else:
                print("[-] FastAPI backend launch skipped or already running.")
        except Exception as e:
            print(f"[-] Error launching FastAPI server: {e}")

    # Open frontend via the Node.js server (same-origin, no CORS issues)
    frontend_url = "http://localhost:5000"
    print(f"\n[+] Opening website: {frontend_url} ...")
    webbrowser.open(frontend_url)

    print("\n" + "=" * 60)
    print("MHT-CET Predictor & Auth Portal is now LIVE!")
    print("Auth + Frontend:   http://localhost:5000")
    print("Predictor Backend: http://127.0.0.1:8000")
    print("To stop servers, press Ctrl+C in this terminal window.")
    print("=" * 60 + "\n")

    if processes:
        try:
            while True:
                time.sleep(2)
        except KeyboardInterrupt:
            print("\n[-] Shutting down servers...")
        finally:
            for proc in processes:
                try:
                    proc.terminate()
                    proc.wait(timeout=2)
                except Exception:
                    proc.kill()
            print("[+] All backend servers stopped.")

if __name__ == "__main__":
    main()
