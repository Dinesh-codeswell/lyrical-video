#!/usr/bin/env python3
"""
Custom uvicorn CLI wrapper for container environments (Railway, Render, Fly.io).
Sanitizes unexpanded shell variables like '${PORT:-8000}' or '$PORT' that platforms
might pass as raw command-line arguments without shell expansion.
"""
import sys
import os

def sanitize_uvicorn_args(args):
    port_env = os.environ.get("PORT", "8000").strip()
    port = port_env if port_env.isdigit() else "8000"
    
    new_argv = []
    has_port = False
    has_host = False

    for arg in args:
        if "${PORT" in arg or arg == "$PORT":
            new_argv.append(port)
            has_port = True
        elif arg.startswith("--port="):
            val = arg.split("=", 1)[1]
            if "${PORT" in val or val == "$PORT" or not val.isdigit():
                new_argv.append(f"--port={port}")
            else:
                new_argv.append(arg)
            has_port = True
        elif arg == "--port":
            has_port = True
            new_argv.append(arg)
        elif arg == "--host" or arg.startswith("--host="):
            has_host = True
            new_argv.append(arg)
        else:
            new_argv.append(arg)

    if not has_port:
        new_argv.extend(["--port", port])
    if not has_host:
        new_argv.extend(["--host", "0.0.0.0"])

    return new_argv

if __name__ == "__main__":
    sys.argv = sanitize_uvicorn_args(sys.argv)
    from uvicorn.main import main
    sys.exit(main())
