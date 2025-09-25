import streamlit as st
import pandas as pd
import geopandas as gpd
import plotly.express as px
import os

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

# Se shapefile existir, carrega
gdf_estradas = None
shp_path = "data/estradas_otto/estradas_otto.shp"
if os.path.exists(shp_path):
    try:
        gdf_estradas = gpd.read_file(shp_path)
    except Exception as e:
        st.warning(f"Erro ao carregar shapefile: {e}")

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
# Abas principais
# ------------------------------
abas = st.tabs([
    "Visão Geral",
    "Meio Físico",
    "Socioeconômico",
    "Outorgas / Hidrologia",
    "Uso do Solo / Conflitos",
    "CAR / Imóveis",
    "Pecuária",
    "Receituários"
])

# ------------------------------
# Conteúdo das abas
# ------------------------------
with abas[0]:
    st.write("### 🌍 Visão Geral")
    if not df_conf.empty and {"Latitude", "Longitude"}.issubset(df_conf.columns):
        st.map(df_conf[["Latitude", "Longitude"]].dropna())
    else:
        st.write("Mapa não disponível – colunas `Latitude` e `Longitude` ausentes.")

with abas[1]:
    st.write("### ⛰️ Meio Físico")
    st.write("Placeholder para gráficos de altitude, declividade e solos.")

with abas[2]:
    st.write("### 👨‍👩‍👧 Socioeconômico")
    st.write("Placeholder para idade, sexo, escolaridade e renda.")

with abas[3]:
    st.write("### 💦 Outorgas / Hidrologia")
    st.write("Placeholder para nascentes, outorgas e vazões.")

with abas[4]:
    st.write("### 🌱 Uso do Solo / Conflitos")
    if not df_conf.empty and "area_conflito" in df_conf.columns:
        fig = px.bar(df_conf, x="Municipio", y="area_conflito", title="Área de Conflito por Município")
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.write("Dados de conflito de uso não disponíveis.")

with abas[5]:
    st.write("### 🏠 CAR / Imóveis")
    st.write("Placeholder para módulos rurais, área média de imóveis...")

with abas[6]:
    st.write("### 🐄 Pecuária")
    st.write("Placeholder para bovinos, suínos, aves...")

with abas[7]:
    st.write("### 🧪 Receituários / Insumos")
    if not df_conf.empty and {"grupo_insumo", "quantidade"}.issubset(df_conf.columns):
        fig = px.bar(df_conf, x="grupo_insumo", y="quantidade", title="Quantidade por Grupo de Insumo")
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.write("Dados de insumos não disponíveis.")
