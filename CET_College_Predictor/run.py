import os
import subprocess
import sys
import time
import webbrowser

def main():
    print("=" * 60)
    print("          MHT-CET Engineering College Predictor")
    print("=" * 60)
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    print("\n[+] Starting FastAPI backend on http://127.0.0.1:8000 ...")
    try:
        server_process = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000", "--reload"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
    except Exception as e:
        print(f"[-] Error launching backend server: {e}")
        return

    time.sleep(2)

    if server_process.poll() is not None:
        print("[-] FastAPI backend failed to start. Logs:")
        print(server_process.stdout.read())
        return

    print("[+] Backend started successfully!")

    html_path = os.path.join(script_dir, "index.html")
    print(f"[+] Opening frontend: file:///{html_path} ...")
    webbrowser.open(f"file:///{html_path}")

    print("\n" + "=" * 60)
    print("Predictor is now running!")
    print("To stop the server, press Ctrl+C in this terminal window.")
    print("=" * 60 + "\n")

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
