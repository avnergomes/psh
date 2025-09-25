import streamlit as st
import pandas as pd
import geopandas as gpd
import plotly.express as px
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

# Logos no topo
col1, col2, col3 = st.columns([6,1,1])
with col2:
    st.image("assets/idr_logo.png", use_column_width=True)
with col3:
    st.image("assets/governo_pr.png", use_column_width=True)

st.title("💧 Programa de Segurança Hídrica – Painel Interativo de Diagnóstico Territorial")

# ------------------------------
# Carregamento de dados
# ------------------------------
df_conf = load_data("data/conflitou_uso.xlsx")
df_ottos = load_data("data/ottos_selec.xlsx")
gdf_estradas = gpd.read_file("data/estradas_otto/estradas_otto.shp")

# Filtros globais
st.sidebar.header("Filtros")
bacias = st.sidebar.multiselect("Selecionar Bacias (CJ)", df_ottos["CJ"].unique())
ottos = st.sidebar.multiselect("Selecionar Ottobacias (ID)", df_ottos["ID"].unique())
municipios = st.sidebar.multiselect("Selecionar Municípios", df_ottos["Municipio"].unique())

# Aplica filtros (exemplo)
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

col1, col2, col3, col4 = st.columns(4)
col1.metric("Bacias", format_number(df_conf["CJ"].nunique()))
col2.metric("Ottobacias", format_number(df_conf["ID"].nunique()))
col3.metric("Área Conflito APP (ha)", format_number(df_conf["area_conflito"].sum()))
col4.metric("Número de Imóveis", format_number(df_conf["num_imoveis"].sum()))

# ------------------------------
# Abas
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
# Exemplo de conteúdo em cada aba
# ------------------------------
with abas[0]:
    st.write("### 🌍 Visão Geral")
    # Exemplo: Mapa com ottobacias
    st.map(df_conf[["Latitude", "Longitude"]].dropna())

with abas[1]:
    st.write("### ⛰️ Meio Físico")
    st.write("Placeholder para gráficos de altitude, declividade, solos...")

with abas[2]:
    st.write("### 👨‍👩‍👧 Socioeconômico")
    st.write("Placeholder para idade, sexo, escolaridade...")

with abas[3]:
    st.write("### 💦 Outorgas / Hidrologia")
    st.write("Placeholder para nascentes, outorgas e vazões...")

with abas[4]:
    st.write("### 🌱 Uso do Solo / Conflitos")
    fig = px.bar(df_conf, x="Municipio", y="area_conflito", title="Área de Conflito por Município")
    st.plotly_chart(fig, use_container_width=True)

with abas[5]:
    st.write("### 🏠 CAR / Imóveis")
    st.write("Placeholder para módulos rurais, área média de imóveis...")

with abas[6]:
    st.write("### 🐄 Pecuária")
    st.write("Placeholder para bovinos, suínos, aves...")

with abas[7]:
    st.write("### 🧪 Receituários / Insumos")
    fig = px.bar(df_conf, x="grupo_insumo", y="quantidade", title="Quantidade por Grupo de Insumo")
    st.plotly_chart(fig, use_container_width=True)
