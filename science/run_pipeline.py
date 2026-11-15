"""
IGNIS Atlas — FireTruth Scientific Pipeline
Script: science/run_pipeline.py
Description: Master CLI entry point for full scientific data processing, calibration,
validation, and reproducible artifact export.
"""

from science.pipeline import generate_validated_pipeline_data

if __name__ == "__main__":
    generate_validated_pipeline_data()

