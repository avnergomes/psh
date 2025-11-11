import streamlit as st
import os

import folium
import pandas as pd
import plotly.express as px
from branca.element import MacroElement
from jinja2 import Template
from streamlit_folium import st_folium
from itertools import cycle
from folium.features import GeoJsonTooltip

from utils.geospatial import (
    add_geodesic_area,
    apply_rename_rules,
    iter_available_parts,
    load_geojson_parts,
    summarize_area,
)
from utils.loaders import load_data
from utils.metrics import format_number

# ------------------------------
# Configurações iniciais
# ------------------------------
st.set_page_config(
    page_title="Programa de Segurança Hídrica",
    page_icon="💧",
    layout="wide"
)


@st.cache_data(show_spinner=False)
def _load_layer_cached(pattern: str, rename_items: tuple):
    rename_rules = dict(rename_items)
    gdf = load_geojson_parts(pattern)
    if gdf.empty:
        return gdf
    if rename_rules:
        gdf = apply_rename_rules(gdf, rename_rules)
    gdf = add_geodesic_area(gdf)
    return gdf


def load_layer(pattern: str, rename_rules: dict | None = None):
    rename_rules = rename_rules or {}
    rename_items = tuple(sorted(rename_rules.items()))
    return _load_layer_cached(pattern, rename_items)


class _DynamicLegend(MacroElement):
    def __init__(self, html_content: str):
        super().__init__()
        self._name = "Legend"
        self.html_content = html_content
        self._template = Template(
            """
            {% macro html(this, kwargs) %}
            <div style="position: fixed; bottom: 30px; left: 30px; z-index: 1000; background: rgba(255, 255, 255, 0.92); border-radius: 8px; padding: 14px; box-shadow: 0 0 15px rgba(0, 0, 0, 0.3); font-size: 13px;">
                <style>
                    #legend-container h4 { margin: 0 0 8px 0; font-size: 14px; }
                    #legend-container ul { list-style: none; padding: 0; margin: 0 0 10px 0; }
                    #legend-container li { display: flex; align-items: center; margin-bottom: 4px; }
                    #legend-container span { display: inline-block; width: 18px; height: 18px; margin-right: 8px; border-radius: 4px; border: 1px solid rgba(0,0,0,0.2); }
                </style>
                <div id="legend-container">{{ this.html_content|safe }}</div>
            </div>
            {% endmacro %}
            """
        )


def build_legend(map_object: folium.Map, sections):
    if not sections:
        return

    content = ""
    for section in sections:
        if not section["items"]:
            continue
        content += f"<h4>{section['title']}</h4><ul>"
        for label, color, area in section["items"]:
            content += (
                "<li><span style='background-color:{color};'></span>{label}: {area:.2f} ha</li>".format(
                    color=color, label=label, area=area
                )
            )
        content += "</ul>"

    if not content:
        return

    legend = _DynamicLegend(content)
    map_object.get_root().add_child(legend)


LAYER_CONFIG = [
    {
        "label": "Microbacias (PSH)",
        "pattern": "data/microbacias_selecionadas__microbacias.geojson_part-*.gz",
        "rename": {
            "Bacia": "Microbacias_Bacia",
            "Manancial": "Microbacias_Manancial",
            "Numero_Manancial": "Microbacias_Nº Manancial",
            "Nome_Manancial": "Microbacias_Nome Manancial",
        },
        "category": "Bacia",
        "tooltip": ["ID", "Bacia", "Manancial", "Nome_Manancial", "area_ha"],
        "style": {"fillOpacity": 0.45, "weight": 1.0, "color": "#2c3e50"},
    },
    {
        "label": "Uso do Solo (Ottobacias)",
        "pattern": "data/uso_solo__usodosolo_otto.geojson_part-*.gz",
        "rename": {
            "Nivel_I": "NIVEL_I",
            "Nivel_II": "NIVEL_II",
            "Nivel_III": "NIVEL_III",
        },
        "category": "Nivel_II",
        "tooltip": ["Nivel_I", "Nivel_II", "Nivel_III", "area_ha"],
        "style": {"fillOpacity": 0.6, "weight": 0.6},
        "simplify": 0.0003,
    },
    {
        "label": "Uso do Solo em APP",
        "pattern": "data/conflitosdeuso__uso_solo_em_app.geojson_part-*.gz",
        "rename": {
            "Nivel_I": "NIVEL_I",
            "Nivel_II": "NIVEL_II",
            "Nivel_III": "NIVEL_III",
        },
        "category": "Nivel_II",
        "tooltip": ["Nivel_I", "Nivel_II", "Nivel_III", "area_ha"],
        "style": {"fillOpacity": 0.6, "weight": 0.6},
        "simplify": 0.0003,
    },
]

# ------------------------------
# Logos (com fallback caso não existam)
# ------------------------------
col1, col2, col3 = st.columns([6, 1, 1])

logo_idr = "assets/idr_logo.png"
logo_pr = "assets/governo_pr.png"

with col2:
    if os.path.exists(logo_idr):
        st.image(logo_idr, use_container_width=True)
    else:
        st.write("IDR-Paraná")

with col3:
    if os.path.exists(logo_pr):
        st.image(logo_pr, use_container_width=True)
    else:
        st.write("Governo PR")

# ------------------------------
# Título principal
# ------------------------------
st.title("💧 Programa de Segurança Hídrica – Painel Interativo de Diagnóstico Territorial")

# ------------------------------
# Carregamento de dados
# ------------------------------
try:
    df_conf = load_data("data/conflitou_uso.xlsx")
    df_ottos = load_data("data/ottos_selec.xlsx")
except Exception as e:
    st.warning(f"Erro ao carregar dados: {e}")
    df_conf, df_ottos = pd.DataFrame(), pd.DataFrame()

# ------------------------------
# Filtros globais
# ------------------------------
st.sidebar.header("Filtros")

if not df_ottos.empty:
    bacias = st.sidebar.multiselect("Selecionar Bacias (CJ)", sorted(df_ottos["CJ"].unique()))
    ottos = st.sidebar.multiselect("Selecionar Ottobacias (ID)", sorted(df_ottos["ID"].unique()))
    municipios = st.sidebar.multiselect("Selecionar Municípios", sorted(df_ottos["Municipio"].unique()))

    if bacias:
        df_conf = df_conf[df_conf["CJ"].isin(bacias)]
    if ottos:
        df_conf = df_conf[df_conf["ID"].isin(ottos)]
    if municipios:
        df_conf = df_conf[df_conf["Municipio"].isin(municipios)]

# ------------------------------
# KPIs principais
# ------------------------------
st.subheader("📊 Indicadores Principais")

if not df_conf.empty:
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Bacias", format_number(df_conf["CJ"].nunique()))
    col2.metric("Ottobacias", format_number(df_conf["ID"].nunique()))
    if "area_conflito" in df_conf.columns:
        col3.metric("Área Conflito APP (ha)", format_number(df_conf["area_conflito"].sum()))
    if "num_imoveis" in df_conf.columns:
        col4.metric("Número de Imóveis", format_number(df_conf["num_imoveis"].sum()))
else:
    st.info("Nenhum dado carregado. Verifique os arquivos em `data/`.")

# ------------------------------
# WebGIS
# ------------------------------
st.subheader("🌐 WebGIS Interativo")
st.write(
    "Selecione as camadas desejadas no menu lateral para explorar o território "
    "em uma única visão integrada. As legendas exibem as áreas calculadas "
    "automaticamente pelo aplicativo."
)

available_patterns = iter_available_parts([cfg["pattern"] for cfg in LAYER_CONFIG])
layer_options = [
    cfg["label"]
    for cfg in LAYER_CONFIG
    if cfg["pattern"] in available_patterns
]

st.sidebar.header("Camadas do WebGIS")
selected_layers = st.sidebar.multiselect(
    "Camadas disponíveis",
    layer_options,
    default=layer_options[:1] if layer_options else [],
)

if not selected_layers:
    st.info("Nenhuma camada selecionada. Escolha ao menos uma camada para exibir o mapa.")
else:
    mapa = folium.Map(location=[-24.5, -51.5], zoom_start=7, tiles="CartoDB positron")
    legend_sections = []
    area_tables = {}
    combined_bounds = []

    palette = px.colors.qualitative.Safe + px.colors.qualitative.Bold + px.colors.qualitative.Plotly

    for layer_label in selected_layers:
        cfg = next((item for item in LAYER_CONFIG if item["label"] == layer_label), None)
        if not cfg:
            continue

        gdf = load_layer(cfg["pattern"], cfg.get("rename"))
        if gdf.empty or gdf.geometry.is_empty.all():
            st.warning(f"Camada '{layer_label}' vazia ou não encontrada.")
            continue

        try:
            epsg = gdf.crs.to_epsg() if gdf.crs else None
        except Exception:
            epsg = None

        if epsg and epsg != 4326:
            gdf_display = gdf.to_crs(epsg=4326)
        else:
            gdf_display = gdf.copy()

        simplify_tol = cfg.get("simplify")
        if simplify_tol:
            gdf_display["geometry"] = gdf_display.geometry.simplify(simplify_tol, preserve_topology=True)

        bounds = gdf_display.total_bounds
        if bounds.any():
            combined_bounds.append(bounds)

        category_field = cfg.get("category")
        summary = summarize_area(gdf, category_field)
        area_tables[layer_label] = summary
        labels = summary["categoria"].tolist()
        if not labels:
            labels = [layer_label]

        color_cycle = cycle(palette)
        color_map = {label: next(color_cycle) for label in labels}

        style_cfg = cfg.get("style", {})

        def _style(feature, field=category_field, base_style=style_cfg, colors=color_map):
            value = feature["properties"].get(field) if field else layer_label
            color = colors.get(value, base_style.get("color", "#2c3e50"))
            return {
                "fillColor": color,
                "color": base_style.get("color", color),
                "weight": base_style.get("weight", 1),
                "fillOpacity": base_style.get("fillOpacity", 0.4),
            }

        tooltip_fields = [field for field in cfg.get("tooltip", []) if field in gdf_display.columns]
        if "area_ha" in gdf_display.columns and "area_ha" not in tooltip_fields:
            tooltip_fields.append("area_ha")

        tooltip_aliases = [
            "Área (ha)" if field == "area_ha" else field.replace("_", " ") for field in tooltip_fields
        ]

        geojson = folium.GeoJson(
            gdf_display,
            name=layer_label,
            style_function=_style,
            highlight_function=lambda x: {"weight": 2, "color": "#000000"},
        )

        if tooltip_fields:
            geojson.add_child(
                GeoJsonTooltip(fields=tooltip_fields, aliases=tooltip_aliases, localize=True)
            )

        geojson.add_to(mapa)

        legend_sections.append(
            {
                "title": layer_label,
                "items": [
                    (row["categoria"], color_map.get(row["categoria"], "#2c3e50"), row["area_ha"])
                    for _, row in summary.iterrows()
                ],
            }
        )

    if combined_bounds:
        minx = min(b[0] for b in combined_bounds)
        miny = min(b[1] for b in combined_bounds)
        maxx = max(b[2] for b in combined_bounds)
        maxy = max(b[3] for b in combined_bounds)
        mapa.fit_bounds([[miny, minx], [maxy, maxx]])

    build_legend(mapa, legend_sections)
    folium.LayerControl(collapsed=False).add_to(mapa)

    st_folium(mapa, height=650, use_container_width=True)

    if area_tables:
        st.markdown("#### Áreas consolidadas por camada")
        for layer_label, table in area_tables.items():
            st.markdown(f"**{layer_label}**")
            st.dataframe(table, hide_index=True, use_container_width=True)

# ------------------------------
# Indicadores adicionais
# ------------------------------
st.subheader("📈 Indicadores Complementares")
if not df_conf.empty and "area_conflito" in df_conf.columns:
    fig = px.bar(
        df_conf,
        x="Municipio",
        y="area_conflito",
        title="Área de Conflito por Município",
        labels={"area_conflito": "Área (ha)", "Municipio": "Município"},
    )
    st.plotly_chart(fig, use_container_width=True)
else:
    st.info("Ainda não há dados consolidados de conflito de uso para exibição em gráfico.")
