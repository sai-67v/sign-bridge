"""
Setup script for Canis v4.

Usage:
    pip install -e .
"""

from setuptools import setup, find_packages

_readme = "README.md" if __import__("os").path.isfile("README.md") else "docs/README_v4.md"
with open(_readme, "r", encoding="utf-8") as f:
    long_description = f.read()

setup(
    name="canis",
    version="4.0.0",
    description="Declarative AI Pipeline Engine with LoRA hot-swapping",
    long_description=long_description,
    long_description_content_type="text/markdown",
    author="Canis Team",
    python_requires=">=3.10",
    packages=find_packages(),
    install_requires=[
        "requests>=2.31.0",
        "pydantic>=2.5.0",
        "jinja2>=3.1.0",
        "rich>=13.7.0",
        "prompt_toolkit>=3.0.43",
        "fastapi>=0.108.0",
        "uvicorn>=0.25.0",
    ],
    entry_points={
        "console_scripts": [
            "canis-cli=canis.interfaces.cli:main",
            "canis-server=canis.interfaces.server:main",
        ],
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Intended Audience :: Education",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "Topic :: Education",
    ],
)
