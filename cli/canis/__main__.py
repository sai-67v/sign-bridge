"""
Canis v4 - Module entry point.

Usage:
    python -m canis             # Start CLI
    python -m canis --server    # Start HTTP server
"""

import sys
import argparse


def main():
    parser = argparse.ArgumentParser(
        description="Canis v4 - Declarative AI Pipeline Engine",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    
    parser.add_argument(
        "--server",
        action="store_true",
        help="Start HTTP server instead of CLI"
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Host address (default: 127.0.0.1)"
    )
    parser.add_argument(
        "--port",
        type=int,
        help="Port number (default: 8080 for CLI, 5000 for server)"
    )
    parser.add_argument(
        "--llama-host",
        default="127.0.0.1",
        help="llama-server host (default: 127.0.0.1)"
    )
    parser.add_argument(
        "--llama-port",
        type=int,
        default=8080,
        help="llama-server port (default: 8080)"
    )
    
    args = parser.parse_args()
    
    if args.server:
        # Start HTTP server
        from canis.interfaces.server import main as server_main
        
        # Override sys.argv for server main
        sys.argv = [
            sys.argv[0],
            "--host", args.host,
            "--port", str(args.port or 5000),
            "--llama-host", args.llama_host,
            "--llama-port", str(args.llama_port),
        ]
        
        server_main()
    else:
        # Start CLI
        from canis.interfaces.cli import main as cli_main
        
        # Override sys.argv for CLI main
        sys.argv = [
            sys.argv[0],
            "--host", args.llama_host,
            "--port", str(args.llama_port),
        ]
        
        cli_main()


if __name__ == "__main__":
    main()
