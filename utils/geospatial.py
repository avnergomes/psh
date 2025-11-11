import gzip
import json
from glob import glob
from typing import Dict, Iterable, List, Optional

import geopandas as gpd
import pandas as pd
from pyproj import Geod


def _extract_epsg_code(crs_info: Optional[dict]) -> Optional[str]:
    if not crs_info:
        return None
    name = crs_info.get("properties", {}).get("name", "")
    if "EPSG::" in name:
        code = name.split("EPSG::")[-1]
        code = code.strip()
        if code:
            return f"EPSG:{code}"
    if name.upper().startswith("EPSG:"):
        return name
    return None


def _load_geojson_file(path: str) -> gpd.GeoDataFrame:
    with gzip.open(path, "rt", encoding="utf-8") as f:
        data = json.load(f)
    gdf = gpd.GeoDataFrame.from_features(data.get("features", []))
    epsg = _extract_epsg_code(data.get("crs"))
    if epsg:
        try:
            gdf.set_crs(epsg, inplace=True)
        except ValueError:
            # Fallback silently if CRS cannot be set
            pass
    return gdf


def load_geojson_parts(pattern: str) -> gpd.GeoDataFrame:
    files = sorted(glob(pattern))
    if not files:
        return gpd.GeoDataFrame()
    frames = []
    for path in files:
        try:
            frames.append(_load_geojson_file(path))
        except json.JSONDecodeError:
            continue
    if not frames:
        return gpd.GeoDataFrame()
    gdf = pd.concat(frames, ignore_index=True)
    if frames[0].crs and gdf.crs is None:
        gdf.set_crs(frames[0].crs, inplace=True)
    return gdf


def apply_rename_rules(gdf: gpd.GeoDataFrame, rename_rules: Dict[str, str]) -> gpd.GeoDataFrame:
    if gdf.empty:
        return gdf
    gdf = gdf.copy()
    for new_name, fragment in rename_rules.items():
        match = next((col for col in gdf.columns if fragment in col), None)
        if match:
            gdf = gdf.rename(columns={match: new_name})
    return gdf


def add_geodesic_area(gdf: gpd.GeoDataFrame, area_column: str = "area_ha") -> gpd.GeoDataFrame:
    if gdf.empty:
        return gdf
    gdf = gdf.copy()
    geod = Geod(ellps="GRS80")

    def _compute_area(geom) -> float:
        if geom is None or geom.is_empty:
            return 0.0
        area, _ = geod.geometry_area_perimeter(geom)
        return abs(area)

    gdf[area_column] = gdf.geometry.apply(lambda geom: _compute_area(geom) / 10_000)
    return gdf


def summarize_area(gdf: gpd.GeoDataFrame, category: Optional[str], area_column: str = "area_ha") -> pd.DataFrame:
    if gdf.empty:
        return pd.DataFrame(columns=["categoria", area_column])
    if category and category in gdf.columns:
        summary = (
            gdf.groupby(category)[area_column]
            .sum()
            .reset_index()
            .rename(columns={category: "categoria"})
            .sort_values(area_column, ascending=False)
        )
    else:
        summary = pd.DataFrame(
            {"categoria": ["Total"], area_column: [gdf[area_column].sum()]}
        )
    summary[area_column] = summary[area_column].round(2)
    return summary


def iter_available_parts(patterns: Iterable[str]) -> Dict[str, List[str]]:
    catalog: Dict[str, List[str]] = {}
    for pattern in patterns:
        files = sorted(glob(pattern))
        if files:
            catalog[pattern] = files
    return catalog
